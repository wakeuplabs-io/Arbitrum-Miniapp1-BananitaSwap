import { createPublicClient, createWalletClient, getAddress, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrum } from 'viem/chains'

const PRIVATE_KEY = process.env.PRIVATE_KEY
if (!PRIVATE_KEY) throw new Error('Set PRIVATE_KEY env var')

const RPC_URL = process.env.RPC_URL || 'https://arb1.arbitrum.io/rpc'
const ROUTER = getAddress(process.env.ROUTER || '0x0e2873AC929e5C6fFD15EA3D9c8CD2ec6cec9Ad0')
const UNISWAP_ADAPTER = getAddress(process.env.UNISWAP_ADAPTER || '0x56b284f2f8e2bd2257396b751766792fb27bddad')
const USDC = getAddress(process.env.USDC || '0xaf88d065e77c8cC2239327C5EDb3A432268e5831')
const UNISWAP_ROUTER = getAddress(process.env.UNISWAP_ROUTER || '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45')
const FEE_BPS = BigInt(process.env.FEE_BPS || '0')
const POOL_FEE = BigInt(process.env.POOL_FEE || '3000')
const PROVIDER_ID = Number(process.env.PROVIDER_ID || '2')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const ROUTER_ABI = [
	{ name: 'initialize', type: 'function', stateMutability: 'nonpayable', inputs: [
		{ name: 'usdc', type: 'address' },
		{ name: 'fee_bps', type: 'uint256' },
		{ name: 'fee_recipient', type: 'address' },
	], outputs: [] },
	{ name: 'setAdapter', type: 'function', stateMutability: 'nonpayable', inputs: [
		{ name: 'id', type: 'uint8' },
		{ name: 'adapter', type: 'address' },
	], outputs: [] },
	{ name: 'getOwner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
	{ name: 'getAdapter', type: 'function', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint8' }], outputs: [{ type: 'address' }] },
]

const UNISWAP_ADAPTER_ABI = [
	{ name: 'initialize', type: 'function', stateMutability: 'nonpayable', inputs: [
		{ name: 'router', type: 'address' },
		{ name: 'pool_fee', type: 'uint256' },
	], outputs: [] },
	{ name: 'getOwner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
]

const account = privateKeyToAccount(PRIVATE_KEY)
const transport = http(RPC_URL)
const pub = createPublicClient({ chain: arbitrum, transport })
const wal = createWalletClient({ account, chain: arbitrum, transport })

async function send(address, abi, functionName, args) {
	const { request } = await pub.simulateContract({
		account,
		address,
		abi,
		functionName,
		args,
		gas: 1_500_000n,
	})
	const hash = await wal.writeContract(request)
	console.log(`tx ${functionName}: ${hash}`)
	await pub.waitForTransactionReceipt({ hash })
}

async function main() {
	console.log('Config:')
	console.log('  router          ', ROUTER)
	console.log('  uniswap adapter ', UNISWAP_ADAPTER)
	console.log('  usdc            ', USDC)
	console.log('  uniswap router  ', UNISWAP_ROUTER)
	console.log('  fee bps         ', FEE_BPS.toString())
	console.log('  pool fee        ', POOL_FEE.toString())
	console.log('  provider id     ', PROVIDER_ID)

	const [routerOwner, adapterOwner] = await Promise.all([
		pub.readContract({ address: ROUTER, abi: ROUTER_ABI, functionName: 'getOwner' }),
		pub.readContract({ address: UNISWAP_ADAPTER, abi: UNISWAP_ADAPTER_ABI, functionName: 'getOwner' }),
	])

	if (routerOwner === ZERO_ADDRESS) {
		await send(ROUTER, ROUTER_ABI, 'initialize', [USDC, FEE_BPS, account.address])
	} else {
		console.log('router already initialized. owner:', routerOwner)
	}

	if (adapterOwner === ZERO_ADDRESS) {
		await send(UNISWAP_ADAPTER, UNISWAP_ADAPTER_ABI, 'initialize', [UNISWAP_ROUTER, POOL_FEE])
	} else {
		console.log('adapter already initialized. owner:', adapterOwner)
	}

	const currentAdapter = await pub.readContract({
		address: ROUTER,
		abi: ROUTER_ABI,
		functionName: 'getAdapter',
		args: [PROVIDER_ID],
	})
	if (currentAdapter.toLowerCase() !== UNISWAP_ADAPTER.toLowerCase()) {
		await send(ROUTER, ROUTER_ABI, 'setAdapter', [PROVIDER_ID, UNISWAP_ADAPTER])
	} else {
		console.log('adapter already registered for provider id', PROVIDER_ID)
	}

	console.log('Initialization done.')
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
