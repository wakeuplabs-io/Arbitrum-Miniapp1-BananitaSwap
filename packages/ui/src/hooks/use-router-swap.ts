import { useCallback, useState } from 'react'
import { parseAbi, parseUnits, type Address, type Hash } from 'viem'
import { callSmartContract, ChainId, TransactionResult } from '@lemoncash/mini-app-sdk'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
import { getNetworkConfig } from '@/shared/config/network'
import { publicClient } from '@/shared/config/viem'
import { resolveRouterProviderId } from '@/lib/resolve-router-provider'
import { routerAbi, getActiveChainKey, getDefaultProviderId, getRouterAddressByNetwork } from '@/shared/config/contracts'

type RouterSwapDirection = 'buy' | 'sell'

export type RouterSwapParams = {
	direction: RouterSwapDirection

	// Token address is:
	// - buy: token being bought
	// - sell: token being sold
	tokenAddress: Address

	amountInHuman: number // USDC in buy, token in sell (human units)
	expectedOutHuman: number // token out in buy, USDC out in sell (human units)

	slippageBps?: number // default: 50 (0.5%)
	providerId?: number
	deadlineSeconds?: number // default: 1200 (20 min)
}

type RouterSwapState =
	| { status: 'idle' }
	| { status: 'pending'; txHash?: Hash }
	| { status: 'success'; txHash: Hash }
	| { status: 'error'; message: string }

const ERC20_ABI = parseAbi([
	'function decimals() view returns (uint8)',
	'function allowance(address owner, address spender) view returns (uint256)',
])
function getMinOutBaseAmount(outBaseAmount: bigint, slippageBps: number): bigint {
	if (slippageBps < 0 || slippageBps >= 10000) {
		throw new Error(`Invalid slippageBps: ${slippageBps}`)
	}

	const multiplier = BigInt(10000 - slippageBps)
	return (outBaseAmount * multiplier) / 10000n
}

function getDeadline(deadlineSeconds: number): bigint {
	return BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds)
}

function toNonExponentialDecimal(value: number, maxDecimals: number): string {
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`Invalid amount value: ${value}`)
	}
	const safeMaxDecimals = Math.max(0, Math.min(maxDecimals, 18))
	const fixed = value.toFixed(safeMaxDecimals)
	return fixed.replace(/\.?0+$/, '')
}

function normalizeTokenDecimals(rawDecimals: number, tokenLabel: string): number {
	if (!Number.isInteger(rawDecimals) || rawDecimals < 0 || rawDecimals > 36) {
		throw new Error(`Invalid decimals for ${tokenLabel}: ${rawDecimals}`)
	}

	return rawDecimals
}

function mapSwapErrorMessage(error: unknown): string {
	const rawMessage = error instanceof Error ? error.message : String(error)
	const isTooLittleReceived = /too little received|min_.*out|insufficient output amount/i.test(rawMessage)
	const isUnexpectedError = /unexpected error|unpected error|unpectected error/i.test(rawMessage)
	const shouldUseGenericTradeMessage = /ethers|ethjs|execution reverted|call exception/i.test(rawMessage)
	if (isTooLittleReceived) return 'No pudimos ejecutar tu trade: el precio cambió. Probá con un monto menor.'
	if (isUnexpectedError) return 'No pudimos ejecutar tu trade'
	return shouldUseGenericTradeMessage ? 'No podemos ejecutar ese trade ahora' : rawMessage
}

function isTooLittleReceivedError(error: unknown): boolean {
	const rawMessage = error instanceof Error ? error.message : String(error)
	return /too little received|min_.*out|insufficient output amount/i.test(rawMessage)
}

function getSlippageAttempts(initialSlippageBps: number): number[] {
	const candidates = [initialSlippageBps, 100, 150, 250, 400]
	return [...new Set(candidates)].filter((bps) => bps >= initialSlippageBps).sort((a, b) => a - b)
}

async function executeLemonContracts(
	contracts: Parameters<typeof callSmartContract>[0]['contracts'],
	whitelistAddresses: string[]
): Promise<{ txHash: Hash; receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>> }> {
	const result = await callSmartContract({ contracts })

	if (result.result === TransactionResult.CANCELLED) {
		throw new Error('Transaction cancelled by user')
	}
	if (result.result === TransactionResult.FAILED) {
		const rawMessage = result.error?.message ?? 'Transaction failed'
		const isWhitelistError = /whitelist|not allowed|not authorized|contract.*not.*registered|not.*whitelisted/i.test(
			rawMessage
		)
		throw new Error(
			isWhitelistError
				? `Contract not whitelisted in Lemon miniapp. Please whitelist: ${whitelistAddresses.join(', ')}`
				: rawMessage
		)
	}

	const txHash = result.data.txHash as Hash
	const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

	if (receipt.status !== 'success') {
		throw new Error(`Transaction reverted on-chain (status=${receipt.status})`)
	}

	return { txHash, receipt }
}

type LemonContractCall = Parameters<typeof callSmartContract>[0]['contracts'][number]

export function useRouterSwap() {
	const { wallet } = useLemonMiniapp()
	const [swapState, setSwapState] = useState<RouterSwapState>({ status: 'idle' })

	const swap = useCallback(
		async (params: RouterSwapParams) => {
			try {

				if (!wallet) {
					throw new Error('Wallet not connected')
				}

				const { direction, tokenAddress, amountInHuman, expectedOutHuman } = params
				const slippageBps = params.slippageBps ?? 50
				const slippageAttempts = getSlippageAttempts(slippageBps)
				const preferredProviderId = params.providerId ?? getDefaultProviderId()
				const deadlineSeconds = params.deadlineSeconds ?? 1200

				if (!Number.isFinite(amountInHuman) || !Number.isFinite(expectedOutHuman)) {
					throw new Error('Invalid swap amounts')
				}

				if (amountInHuman <= 0 || expectedOutHuman <= 0) {
					throw new Error('Invalid swap amounts')
				}

				const networkKey = getActiveChainKey()
				const routerAddress = getRouterAddressByNetwork(networkKey)
				const chainId = getNetworkConfig().chain.id as ChainId
				const signerAccount = wallet.toLowerCase() as Address

				const { providerId, adapterAddress } = await resolveRouterProviderId(
					publicClient,
					routerAddress,
					preferredProviderId
				)
				if (providerId !== preferredProviderId) {
					console.warn(
						'[swap] Preferred provider',
						preferredProviderId,
						'has no adapter; using',
						providerId,
						'instead'
					)
				}


				const usdcAddress = await publicClient.readContract({
					address: routerAddress,
					abi: routerAbi,
					functionName: 'getUsdc',
				})


				const [usdcDecimalsRaw, tokenDecimalsRaw] = await Promise.all([
					publicClient.readContract({
						address: usdcAddress,
						abi: ERC20_ABI,
						functionName: 'decimals',
					}),
					publicClient.readContract({
						address: tokenAddress,
						abi: ERC20_ABI,
						functionName: 'decimals',
					}),
				])
				const usdcDecimals = normalizeTokenDecimals(Number(usdcDecimalsRaw), 'USDC')
				const tokenDecimals = normalizeTokenDecimals(Number(tokenDecimalsRaw), tokenAddress)


				let approveContract: LemonContractCall | null = null
				let runSwapSimulation: (() => Promise<LemonContractCall>) | null = null

				if (direction === 'buy') {
					const usdcAmountBase = parseUnits(
						toNonExponentialDecimal(amountInHuman, usdcDecimals),
						usdcDecimals
					)
					const expectedTokenOutBase = parseUnits(
						toNonExponentialDecimal(expectedOutHuman, tokenDecimals),
						tokenDecimals
					)
					const deadline = getDeadline(deadlineSeconds)

					const allowance = await publicClient.readContract({
						address: usdcAddress,
						abi: ERC20_ABI,
						functionName: 'allowance',
						args: [signerAccount, routerAddress],
					})


					runSwapSimulation = async () => {
						let lastError: unknown = null
						for (const candidateSlippageBps of slippageAttempts) {
							const candidateMinTokenOutBase = getMinOutBaseAmount(expectedTokenOutBase, candidateSlippageBps)
							try {
								await publicClient.simulateContract({
									address: routerAddress,
									abi: routerAbi,
									functionName: 'buy',
									args: [tokenAddress, usdcAmountBase, candidateMinTokenOutBase, providerId, deadline],
									account: signerAccount,
								})
								return {
									contractAddress: routerAddress,
									functionName: 'buy',
									functionParams: [
										tokenAddress,
										usdcAmountBase.toString(),
										candidateMinTokenOutBase.toString(),
										providerId,
										deadline.toString(),
									],
									value: '0',
									chainId,
								}
							} catch (error) {
								lastError = error
								if (!isTooLittleReceivedError(error)) throw error
							}
						}
						throw lastError ?? new Error('No pudimos ejecutar tu trade')
					}

					if (allowance < usdcAmountBase) {
						approveContract = {
							contractAddress: usdcAddress,
							functionName: 'approve',
							functionParams: [routerAddress, usdcAmountBase.toString()],
							value: '0',
							chainId,
						}
					}

				} else {
					const tokenAmountBase = parseUnits(
						toNonExponentialDecimal(amountInHuman, tokenDecimals),
						tokenDecimals
					)
					const expectedUsdcOutBase = parseUnits(
						toNonExponentialDecimal(expectedOutHuman, usdcDecimals),
						usdcDecimals
					)
					const deadline = getDeadline(deadlineSeconds)

					const allowance = await publicClient.readContract({
						address: tokenAddress,
						abi: ERC20_ABI,
						functionName: 'allowance',
						args: [signerAccount, routerAddress],
					})


					runSwapSimulation = async () => {
						let lastError: unknown = null
						for (const candidateSlippageBps of slippageAttempts) {
							const candidateMinUsdcOutBase = getMinOutBaseAmount(expectedUsdcOutBase, candidateSlippageBps)
							try {
								await publicClient.simulateContract({
									address: routerAddress,
									abi: routerAbi,
									functionName: 'sell',
									args: [tokenAddress, tokenAmountBase, candidateMinUsdcOutBase, providerId, deadline],
									account: signerAccount,
								})
								return {
									contractAddress: routerAddress,
									functionName: 'sell',
									functionParams: [
										tokenAddress,
										tokenAmountBase.toString(),
										candidateMinUsdcOutBase.toString(),
										providerId,
										deadline.toString(),
									],
									value: '0',
									chainId,
								}
							} catch (error) {
								lastError = error
								if (!isTooLittleReceivedError(error)) throw error
							}
						}
						throw lastError ?? new Error('No pudimos ejecutar tu trade')
					}

					if (allowance < tokenAmountBase) {
						approveContract = {
							contractAddress: tokenAddress,
							functionName: 'approve',
							functionParams: [routerAddress, tokenAmountBase.toString()],
							value: '0',
							chainId,
						}
					}

				}

				setSwapState({ status: 'pending' })
				if (approveContract) {
					await executeLemonContracts([approveContract], [approveContract.contractAddress])
					if (direction === 'buy') {
						const refreshedAllowance = await publicClient.readContract({
							address: usdcAddress,
							abi: ERC20_ABI,
							functionName: 'allowance',
							args: [signerAccount, routerAddress],
						})
						if (refreshedAllowance === 0n) {
							throw new Error('Approval failed. Please try again.')
						}
					} else {
						const refreshedAllowance = await publicClient.readContract({
							address: tokenAddress,
							abi: ERC20_ABI,
							functionName: 'allowance',
							args: [signerAccount, routerAddress],
						})
						if (refreshedAllowance === 0n) {
							throw new Error('Approval failed. Please try again.')
						}
					}
				}

				if (!runSwapSimulation) {
					throw new Error('Invalid swap request')
				}

				const swapContract = await runSwapSimulation()
				const { txHash, receipt } = await executeLemonContracts([swapContract], [swapContract.contractAddress])
				setSwapState({ status: 'pending', txHash })

				setSwapState({ status: 'success', txHash })
				return { txHash, receipt }
			} catch (error) {
				console.error('[swap] error', error)
				const message = mapSwapErrorMessage(error)
				setSwapState({ status: 'error', message })
				throw error
			}
		},
		[wallet]
	)

	return {
		swap,
		swapState,
		isSwapping: swapState.status === 'pending',
		errorMessage: swapState.status === 'error' ? swapState.message : undefined,
	}
}
