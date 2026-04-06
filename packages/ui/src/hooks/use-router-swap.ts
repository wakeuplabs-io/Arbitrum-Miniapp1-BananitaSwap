import { useCallback, useState } from 'react'
import { parseAbi, parseUnits, type Address, type Hash } from 'viem'
import { callSmartContract, ChainId, TransactionResult } from '@lemoncash/mini-app-sdk'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
import { getNetworkConfig } from '@/shared/config/network'
import { publicClient } from '@/shared/config/viem'
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
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

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

export function useRouterSwap() {
	const { wallet } = useLemonMiniapp()
	const [swapState, setSwapState] = useState<RouterSwapState>({ status: 'idle' })

	const swap = useCallback(
		async (params: RouterSwapParams) => {
			try {
				console.log('[swap] start', params)

				if (!wallet) {
					throw new Error('Wallet not connected')
				}

				const { direction, tokenAddress, amountInHuman, expectedOutHuman } = params
				const slippageBps = params.slippageBps ?? 50
				const providerId = params.providerId ?? getDefaultProviderId()
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

				console.log('[swap] network', { networkKey, routerAddress, chainId, signerAccount, providerId, slippageBps })

				const usdcAddress = await publicClient.readContract({
					address: routerAddress,
					abi: routerAbi,
					functionName: 'getUsdc',
				})

				const adapterAddress = await publicClient.readContract({
					address: routerAddress,
					abi: routerAbi,
					functionName: 'getAdapter',
					args: [providerId],
				})

				if (adapterAddress.toLowerCase() === ZERO_ADDRESS) {
					throw new Error(
						`Provider ${providerId} has no adapter configured in router ${routerAddress}. Check VITE_PROVIDER_ID/deployment.`
					)
				}

				console.log('[swap] addresses', { usdcAddress, adapterAddress })

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

				console.log('[swap] decimals', { usdcDecimals, tokenDecimals })

				// Build the contracts array for callSmartContract.
				// If allowance is insufficient, prepend an approve so the user
				// signs both steps in a single Lemon confirmation dialog.
				const contracts: Parameters<typeof callSmartContract>[0]['contracts'] = []

				if (direction === 'buy') {
					const usdcAmountBase = parseUnits(
						toNonExponentialDecimal(amountInHuman, usdcDecimals),
						usdcDecimals
					)
					const expectedTokenOutBase = parseUnits(
						toNonExponentialDecimal(expectedOutHuman, tokenDecimals),
						tokenDecimals
					)
					const minTokenOutBase = getMinOutBaseAmount(expectedTokenOutBase, slippageBps)
					const deadline = getDeadline(deadlineSeconds)

					const allowance = await publicClient.readContract({
						address: usdcAddress,
						abi: ERC20_ABI,
						functionName: 'allowance',
						args: [signerAccount, routerAddress],
					})

					console.log('[swap] buy', {
						usdcAmountBase: usdcAmountBase.toString(),
						expectedTokenOutBase: expectedTokenOutBase.toString(),
						minTokenOutBase: minTokenOutBase.toString(),
						deadline: deadline.toString(),
						allowance: allowance.toString(),
						needsApprove: allowance < usdcAmountBase,
					})

					if (allowance < usdcAmountBase) {
						contracts.push({
							contractAddress: usdcAddress,
							functionName: 'approve',
							functionParams: [routerAddress, usdcAmountBase.toString()],
							value: '0',
							chainId,
						})
					}

					contracts.push({
						contractAddress: routerAddress,
						functionName: 'buy',
						functionParams: [
							tokenAddress,
							usdcAmountBase.toString(),
							minTokenOutBase.toString(),
							providerId,
							deadline.toString(),
						],
						value: '0',
						chainId,
					})
				} else {
					const tokenAmountBase = parseUnits(
						toNonExponentialDecimal(amountInHuman, tokenDecimals),
						tokenDecimals
					)
					const expectedUsdcOutBase = parseUnits(
						toNonExponentialDecimal(expectedOutHuman, usdcDecimals),
						usdcDecimals
					)
					const minUsdcOutBase = getMinOutBaseAmount(expectedUsdcOutBase, slippageBps)
					const deadline = getDeadline(deadlineSeconds)

					const allowance = await publicClient.readContract({
						address: tokenAddress,
						abi: ERC20_ABI,
						functionName: 'allowance',
						args: [signerAccount, routerAddress],
					})

					console.log('[swap] sell', {
						tokenAmountBase: tokenAmountBase.toString(),
						expectedUsdcOutBase: expectedUsdcOutBase.toString(),
						minUsdcOutBase: minUsdcOutBase.toString(),
						deadline: deadline.toString(),
						allowance: allowance.toString(),
						needsApprove: allowance < tokenAmountBase,
					})

					if (allowance < tokenAmountBase) {
						contracts.push({
							contractAddress: tokenAddress,
							functionName: 'approve',
							functionParams: [routerAddress, tokenAmountBase.toString()],
							value: '0',
							chainId,
						})
					}

					contracts.push({
						contractAddress: routerAddress,
						functionName: 'sell',
						functionParams: [
							tokenAddress,
							tokenAmountBase.toString(),
							minUsdcOutBase.toString(),
							providerId,
							deadline.toString(),
						],
						value: '0',
						chainId,
					})
				}

				console.log('[swap] calling callSmartContract', contracts)
				setSwapState({ status: 'pending' })
				const result = await callSmartContract({ contracts })

				console.log('[swap] callSmartContract result', result)

				if (result.result === TransactionResult.CANCELLED) {
					throw new Error('Transaction cancelled by user')
				}
				if (result.result === TransactionResult.FAILED) {
					const rawMessage = result.error?.message ?? 'Transaction failed'
					const isWhitelistError = /whitelist|not allowed|not authorized|contract.*not.*registered|not.*whitelisted/i.test(rawMessage)
					throw new Error(
						isWhitelistError
							? `Contract not whitelisted in Lemon miniapp. Please whitelist: ${contracts.map(c => c.contractAddress).join(', ')}`
							: rawMessage
					)
				}

				// SUCCESS or PENDING — both include txHash
				const txHash = result.data.txHash as Hash
				setSwapState({ status: 'pending', txHash })

				console.log('[swap] waiting for receipt', txHash)
				const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
				console.log('[swap] receipt', receipt)

				if (receipt.status !== 'success') {
					throw new Error(`Transaction reverted on-chain (status=${receipt.status})`)
				}

				setSwapState({ status: 'success', txHash })
				return { txHash, receipt }
			} catch (error) {
				console.error('[swap] error', error)
				const message = error instanceof Error ? error.message : String(error)
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
