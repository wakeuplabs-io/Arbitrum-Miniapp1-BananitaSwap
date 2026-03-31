import { createPublicClient, createWalletClient, formatUnits, getAddress, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrum } from 'viem/chains'

const PRIVATE_KEY = process.env.PRIVATE_KEY
if (!PRIVATE_KEY) throw new Error('Set PRIVATE_KEY env var')

const RPC_URL = process.env.RPC_URL || 'https://arb1.arbitrum.io/rpc'
const ROUTER = getAddress(process.env.ROUTER || '0x0e2873AC929e5C6fFD15EA3D9c8CD2ec6cec9Ad0')
const USDC = getAddress(process.env.USDC || '0xaf88d065e77c8cC2239327C5EDb3A432268e5831')
const WETH = getAddress(process.env.WETH || '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1')
const PROVIDER_ID = Number(process.env.PROVIDER_ID || '2')

const SWAP_MODE = process.env.SWAP_MODE || 'buy'
const AMOUNT_HUMAN = process.env.AMOUNT_HUMAN || '1'
const MIN_OUT_HUMAN = process.env.MIN_OUT_HUMAN || '0'

const ROUTER_ABI = [
	{ name: 'buy', type: 'function', stateMutability: 'nonpayable', inputs: [
		{ name: 'token', type: 'address' },
		{ name: 'usdc_amount', type: 'uint256' },
		{ name: 'min_token_out', type: 'uint256' },
		{ name: 'provider_id', type: 'uint8' },
		{ name: 'deadline', type: 'uint256' },
	], outputs: [{ type: 'uint256' }] },
	{ name: 'sell', type: 'function', stateMutability: 'nonpayable', inputs: [
		{ name: 'token', type: 'address' },
		{ name: 'token_amount', type: 'uint256' },
		{ name: 'min_usdc_out', type: 'uint256' },
		{ name: 'provider_id', type: 'uint8' },
		{ name: 'deadline', type: 'uint256' },
	], outputs: [{ type: 'uint256' }] },
	{ name: 'getOwner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
	{ name: 'getUsdc', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
	{ name: 'getFeeBps', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
	{ name: 'getAdapter', type: 'function', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint8' }], outputs: [{ type: 'address' }] },
]

const ERC20_ABI = [
	{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
	{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
	{ name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
]

const account = privateKeyToAccount(PRIVATE_KEY)
const transport = http(RPC_URL)
const publicClient = createPublicClient({ chain: arbitrum, transport })
const walletClient = createWalletClient({ account, chain: arbitrum, transport })

async function read(address, abi, functionName, args = []) {
	return publicClient.readContract({ address, abi, functionName, args })
}

async function send(address, abi, functionName, args) {
	const { request } = await publicClient.simulateContract({
		account,
		address,
		abi,
		functionName,
		args,
		gas: 5_000_000n,
	})
	const hash = await walletClient.writeContract(request)
	console.log(`tx ${functionName}: ${hash}`)
	const receipt = await publicClient.waitForTransactionReceipt({ hash })
	console.log(`status: ${receipt.status} gas: ${receipt.gasUsed}`)
	return receipt
}

async function main() {
	const [owner, usdcFromRouter, feeBps, adapter] = await Promise.all([
		read(ROUTER, ROUTER_ABI, 'getOwner'),
		read(ROUTER, ROUTER_ABI, 'getUsdc'),
		read(ROUTER, ROUTER_ABI, 'getFeeBps'),
		read(ROUTER, ROUTER_ABI, 'getAdapter', [PROVIDER_ID]),
	])

	console.log('Router state:')
	console.log('  owner       ', owner)
	console.log('  usdc        ', usdcFromRouter)
	console.log('  fee bps     ', feeBps.toString())
	console.log('  adapter id  ', PROVIDER_ID, '=>', adapter)

	if (adapter.toLowerCase() === '0x0000000000000000000000000000000000000000') {
		throw new Error(`Provider id ${PROVIDER_ID} has no adapter. Run initialize.mjs first.`)
	}

	const usdcBefore = await read(USDC, ERC20_ABI, 'balanceOf', [account.address])
	const wethBefore = await read(WETH, ERC20_ABI, 'balanceOf', [account.address])

	console.log('Balances before:')
	console.log('  USDC', formatUnits(usdcBefore, 6))
	console.log('  WETH', formatUnits(wethBefore, 18))

	const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

	if (SWAP_MODE === 'buy') {
		const usdcAmount = parseUnits(AMOUNT_HUMAN, 6)
		const minTokenOut = parseUnits(MIN_OUT_HUMAN, 18)
		const allowance = await read(USDC, ERC20_ABI, 'allowance', [account.address, ROUTER])
		if (allowance < usdcAmount) {
			await send(USDC, ERC20_ABI, 'approve', [ROUTER, usdcAmount])
		}
		await send(ROUTER, ROUTER_ABI, 'buy', [WETH, usdcAmount, minTokenOut, PROVIDER_ID, deadline])
	} else if (SWAP_MODE === 'sell') {
		const tokenAmount = parseUnits(AMOUNT_HUMAN, 18)
		const minUsdcOut = parseUnits(MIN_OUT_HUMAN, 6)
		const allowance = await read(WETH, ERC20_ABI, 'allowance', [account.address, ROUTER])
		if (allowance < tokenAmount) {
			await send(WETH, ERC20_ABI, 'approve', [ROUTER, tokenAmount])
		}
		await send(ROUTER, ROUTER_ABI, 'sell', [WETH, tokenAmount, minUsdcOut, PROVIDER_ID, deadline])
	} else {
		throw new Error('SWAP_MODE must be "buy" or "sell"')
	}

	const usdcAfter = await read(USDC, ERC20_ABI, 'balanceOf', [account.address])
	const wethAfter = await read(WETH, ERC20_ABI, 'balanceOf', [account.address])

	console.log('Balances after:')
	console.log('  USDC', formatUnits(usdcAfter, 6), `(diff ${formatUnits(usdcAfter - usdcBefore, 6)})`)
	console.log('  WETH', formatUnits(wethAfter, 18), `(diff ${formatUnits(wethAfter - wethBefore, 18)})`)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
