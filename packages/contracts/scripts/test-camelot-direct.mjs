import {
	createPublicClient,
	createWalletClient,
	formatUnits,
	getAddress,
	http,
	parseUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrum } from 'viem/chains'

const PRIVATE_KEY = process.env.PRIVATE_KEY
if (!PRIVATE_KEY) throw new Error('Set PRIVATE_KEY env var')

const RPC_URL = process.env.RPC_URL || 'https://arb1.arbitrum.io/rpc'
const USDC = getAddress(process.env.USDC || '0xaf88d065e77c8cC2239327C5EDb3A432268e5831')
const TOKEN_OUT = getAddress(process.env.TOKEN_OUT || '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1')
const CAMELOT_ROUTER = getAddress(process.env.CAMELOT_ROUTER || '')
const AMOUNT_HUMAN = process.env.AMOUNT_HUMAN || '1'
const MIN_OUT_HUMAN = process.env.MIN_OUT_HUMAN || '0'

if (!process.env.CAMELOT_ROUTER) {
	throw new Error('Set CAMELOT_ROUTER env var')
}

const ERC20_ABI = [
	{
		name: 'balanceOf',
		type: 'function',
		stateMutability: 'view',
		inputs: [{ name: 'account', type: 'address' }],
		outputs: [{ type: 'uint256' }],
	},
	{
		name: 'allowance',
		type: 'function',
		stateMutability: 'view',
		inputs: [
			{ name: 'owner', type: 'address' },
			{ name: 'spender', type: 'address' },
		],
		outputs: [{ type: 'uint256' }],
	},
	{
		name: 'approve',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: 'spender', type: 'address' },
			{ name: 'amount', type: 'uint256' },
		],
		outputs: [{ type: 'bool' }],
	},
]

const CAMELOT_ROUTER_ABI = [
	{
		name: 'exactInputSingle',
		type: 'function',
		stateMutability: 'payable',
		inputs: [
			{
				name: 'params',
				type: 'tuple',
				components: [
					{ name: 'tokenIn', type: 'address' },
					{ name: 'tokenOut', type: 'address' },
					{ name: 'recipient', type: 'address' },
					{ name: 'deadline', type: 'uint256' },
					{ name: 'amountIn', type: 'uint256' },
					{ name: 'amountOutMinimum', type: 'uint256' },
					{ name: 'sqrtPriceLimitX96', type: 'uint160' },
				],
			},
		],
		outputs: [{ name: 'amountOut', type: 'uint256' }],
	},
]

const account = privateKeyToAccount(PRIVATE_KEY)
const transport = http(RPC_URL)
const publicClient = createPublicClient({ chain: arbitrum, transport })
const walletClient = createWalletClient({ account, chain: arbitrum, transport })

function buildDeadline(secondsFromNow = 1_200) {
	return BigInt(Math.floor(Date.now() / 1_000) + secondsFromNow)
}

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
	const amountIn = parseUnits(AMOUNT_HUMAN, 6)
	const minOut = parseUnits(MIN_OUT_HUMAN, 18)
	const deadline = buildDeadline()

	console.log('Config:')
	console.log('  account        ', account.address)
	console.log('  rpc            ', RPC_URL)
	console.log('  camelot router ', CAMELOT_ROUTER)
	console.log('  token in (USDC)', USDC)
	console.log('  token out      ', TOKEN_OUT)
	console.log('  amount in      ', amountIn.toString())
	console.log('  min out        ', minOut.toString())

	const [code, usdcBefore, tokenBefore] = await Promise.all([
		publicClient.getCode({ address: CAMELOT_ROUTER }),
		read(USDC, ERC20_ABI, 'balanceOf', [account.address]),
		read(TOKEN_OUT, ERC20_ABI, 'balanceOf', [account.address]),
	])

	if (!code || code === '0x') {
		throw new Error(`CAMELOT_ROUTER has no code on this network: ${CAMELOT_ROUTER}`)
	}

	console.log('Balances before:')
	console.log('  USDC', formatUnits(usdcBefore, 6))
	console.log('  OUT ', formatUnits(tokenBefore, 18))

	const allowance = await read(USDC, ERC20_ABI, 'allowance', [account.address, CAMELOT_ROUTER])
	if (allowance < amountIn) {
		console.log('Approving USDC to Camelot router...')
		await send(USDC, ERC20_ABI, 'approve', [CAMELOT_ROUTER, amountIn])
	}

	const params = {
		tokenIn: USDC,
		tokenOut: TOKEN_OUT,
		recipient: account.address,
		deadline,
		amountIn,
		amountOutMinimum: minOut,
		sqrtPriceLimitX96: 0n,
	}

	await send(CAMELOT_ROUTER, CAMELOT_ROUTER_ABI, 'exactInputSingle', [params])

	const [usdcAfter, tokenAfter] = await Promise.all([
		read(USDC, ERC20_ABI, 'balanceOf', [account.address]),
		read(TOKEN_OUT, ERC20_ABI, 'balanceOf', [account.address]),
	])

	console.log('Balances after:')
	console.log('  USDC', formatUnits(usdcAfter, 6), `(diff ${formatUnits(usdcAfter - usdcBefore, 6)})`)
	console.log('  OUT ', formatUnits(tokenAfter, 18), `(diff ${formatUnits(tokenAfter - tokenBefore, 18)})`)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
