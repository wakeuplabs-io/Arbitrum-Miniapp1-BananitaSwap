/**
 * One-shot EIP-2535 diamondCut on the Stylus Diamond proxy (rust-contracts).
 *
 * Registers loupe, ownership, router, and Uniswap admin selectors. Matches Stylus #[public] ABI
 * (Rust snake_case selectors). Deploy layout similar to packages/sol-contracts/scripts/deploy.js.
 *
 * Usage (from packages/sol-contracts, with PRIVATE_KEY and RPC in .env):
 *   node scripts/rust-diamond-cut.js
 *
 * Env:
 *   PRIVATE_KEY
 *   ARBITRUM_RPC_URL | ARBITRUM_SEPOLIA_RPC_URL | CHAIN_ID=42161
 *   DEPLOYMENTS_JSON — default: ../rust-contracts/deployments-arbitrum-one.json
 *   DIAMOND — override proxy address
 *   SKIP_INIT=1 — omit DiamondInit delegate (init already done)
 *   USDC_ADDRESS, FEE_RECIPIENT, FEE_BPS, CAMELOT_ROUTER — passed to init() when SKIP_INIT unset
 *
 * Requires: ethers + dotenv (this package).
 */

const fs = require('fs')
const path = require('path')
require('dotenv').config()

const { ethers } = require('ethers')

const SELECTORS = {
	loupe: [
		'0x5794725f', // facet_address(bytes4)
		'0xc2a88abe', // facet_addresses()
		'0xadfca15e', // facet_function_selectors(address)
		'0x7a0ed627', // facets()
	],
	ownership: [
		'0x8da5cb5b', // owner()
		'0xf0350c04', // transfer_ownership(address)
	],
	router: [
		'0xd8efc58c', // buy(...)
		'0x548baaf8', // sell(...)
		'0xe7aa1a06', // set_provider(bytes32,address)
		'0x31ace33e', // set_token_whitelist(address,bool)
		'0x1aa02d59', // set_fee(uint256)
		'0x30cc317b', // set_fee_recipient(address)
		'0x95281d42', // set_camelot_router(address)
	],
	uniswapAdmin: [
		'0xcbe72052', // set_uniswap_v3_router(address)
		'0x879e8985', // set_uniswap_v3_pool_fee(uint256)
	],
}

const DIAMOND_CUT_ABI = [
	'function diamondCut(tuple(address facetAddress,uint8 action,bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata) external',
]

const INIT_ABI = [
	'function init(address usdc, address feeRecipient, uint256 feeBps, address camelotRouter) external',
]

const LOUPE_PREVIEW_ABI = ['function facet_address(bytes4 selector) view returns (address facet)']

function loadDeployments(defaultRelativeToScript) {
	const p =
		process.env.DEPLOYMENTS_JSON ||
		path.join(__dirname, defaultRelativeToScript)
	const raw = fs.readFileSync(p, 'utf8')
	const j = JSON.parse(raw)
	return { path: p, json: j }
}

async function main() {
	const privateKey = process.env.PRIVATE_KEY
	if (!privateKey) throw new Error('Set PRIVATE_KEY in .env')

	const rpcUrl =
		process.env.ARBITRUM_RPC_URL ||
		process.env.ARBITRUM_SEPOLIA_RPC_URL ||
		(process.env.CHAIN_ID === '42161' ? 'https://arb1.arbitrum.io/rpc' : 'https://sepolia-rollup.arbitrum.io/rpc')

	const provider = new ethers.JsonRpcProvider(rpcUrl)
	const signer = new ethers.Wallet(privateKey, provider)
	const network = await provider.getNetwork()
	const chainId = Number(network.chainId)
	const isArbitrumOne = chainId === 42161

	const { path: depPath, json: dep } = loadDeployments('../rust-contracts/deployments-arbitrum-one.json')
	const diamondAddress = process.env.DIAMOND || dep.diamond
	if (!diamondAddress) throw new Error('Missing diamond address (DIAMOND or deployments JSON)')

	const loupe = dep['diamond-loupe-facet']
	const ownership = dep['ownership-facet']
	const router = dep['router-facet']
	const uniswap = dep['uniswap-v3-facet']
	const diamondInit = dep['diamond-init']

	if (!loupe || !ownership || !router || !uniswap || !diamondInit) {
		throw new Error(`Incomplete deployments file: ${depPath}`)
	}

	console.log('Network chainId:', chainId, isArbitrumOne ? '(Arbitrum One)' : '')
	console.log('Deployments:', depPath)
	console.log('Diamond:', diamondAddress)
	console.log('Signer:', signer.address)

	const preview = new ethers.Contract(diamondAddress, LOUPE_PREVIEW_ABI, provider)
	const buySel = SELECTORS.router[0]
	try {
		const existing = await preview.facet_address(buySel)
		if (existing !== ethers.ZeroAddress) {
			throw new Error(
				`buy() already mapped to ${existing}. diamondCut ADD would revert. ` +
					'Use a fresh Diamond or replace/remove cuts.'
			)
		}
	} catch (e) {
		console.log('Preview check skipped (loupe not wired yet); proceeding with diamondCut.')
	}

	const cuts = [
		{ facetAddress: loupe, action: 0, functionSelectors: SELECTORS.loupe },
		{ facetAddress: ownership, action: 0, functionSelectors: SELECTORS.ownership },
		{ facetAddress: router, action: 0, functionSelectors: SELECTORS.router },
		{ facetAddress: uniswap, action: 0, functionSelectors: SELECTORS.uniswapAdmin },
	]

	let initAddress = ethers.ZeroAddress
	let initCalldata = '0x'

	if (process.env.SKIP_INIT !== '1') {
		const usdc =
			process.env.USDC_ADDRESS ||
			(isArbitrumOne ? '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' : null)
		if (!usdc) throw new Error('Set USDC_ADDRESS for init on this network, or SKIP_INIT=1')

		const feeRecipient = process.env.FEE_RECIPIENT || signer.address
		const feeBps = BigInt(process.env.FEE_BPS ?? '0')
		const camelotRouter = process.env.CAMELOT_ROUTER || ethers.ZeroAddress
		if (!process.env.CAMELOT_ROUTER) {
			console.warn('WARNING: CAMELOT_ROUTER not set — storing ZeroAddress. Call set_camelot_router() after setup.')
		}

		const initIface = new ethers.Interface(INIT_ABI)
		initCalldata = initIface.encodeFunctionData('init', [usdc, feeRecipient, feeBps, camelotRouter])
		initAddress = diamondInit
		console.log('Init target:', initAddress, '| USDC:', usdc, '| feeBps:', feeBps.toString(), '| camelotRouter:', camelotRouter)
	} else {
		console.log('SKIP_INIT=1 — not calling DiamondInit')
	}

	const cutIface = new ethers.Interface(DIAMOND_CUT_ABI)
	const data = cutIface.encodeFunctionData('diamondCut', [cuts, initAddress, initCalldata])

	console.log('Sending diamondCut...')
	const tx = await signer.sendTransaction({ to: diamondAddress, data })
	console.log('Tx hash:', tx.hash)
	const rec = await tx.wait()
	console.log('Mined in block:', rec.blockNumber)
	console.log('Done. Next: set-provider / set-uniswap-provider, whitelist tokens, etc.')
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
