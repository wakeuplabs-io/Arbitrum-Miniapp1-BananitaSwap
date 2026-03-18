/**
 * Swap via Uniswap SwapRouter02 directly (no Diamond).
 *
 * Arbitrum One:  npx hardhat run scripts/swap-via-router.js --network arbitrumOne
 * Arbitrum Sepolia: pools often have no liquidity; use swap.js + Camelot for testnet.
 *
 * Minimum to test on mainnet: 0.1 USDC (recommended) or 1 USDC. Use minOutHuman > 0 for slippage.
 */
require('dotenv').config()
const { ethers } = require('hardhat')
const { WETH, USDC } = require('./constants')

// Arbitrum One mainnet (Uniswap deployments)
const ARB_ONE = {
	WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
	USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // native USDC
	SwapRouter02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
}

const POOL_FEE = parseInt(process.env.UNISWAP_V3_POOL_FEE || '3000', 10)

// Use small amount for mainnet test (0.1 USDC). Override with env: SWAP_AMOUNT_HUMAN=0.1
const config = {
	mode: 'buy',
	amountHuman: process.env.SWAP_AMOUNT_HUMAN || '0.1', // minimum practical test on mainnet
	minOutHuman: process.env.SWAP_MIN_OUT_HUMAN || '0',
}

// ABI for exactInputSingle only (avoids artifact lookup issues)
const ROUTER_ABI = [
	{
		inputs: [
			{
				components: [
					{ name: 'tokenIn', type: 'address' },
					{ name: 'tokenOut', type: 'address' },
					{ name: 'fee', type: 'uint24' },
					{ name: 'recipient', type: 'address' },
					{ name: 'amountIn', type: 'uint256' },
					{ name: 'amountOutMinimum', type: 'uint256' },
					{ name: 'sqrtPriceLimitX96', type: 'uint160' },
				],
				internalType: 'struct IV3SwapRouter.ExactInputSingleParams',
				name: 'params',
				type: 'tuple',
			},
		],
		name: 'exactInputSingle',
		outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
		stateMutability: 'payable',
		type: 'function',
	},
]

async function main() {
	const [signer] = await ethers.getSigners()
	if (!signer) throw new Error('No signer. Set PRIVATE_KEY in .env')

	const network = await ethers.provider.getNetwork()
	const chainId = Number(network.chainId)
	const isArbitrumOne = chainId === 42161

	const WETH_ADDR = isArbitrumOne ? ARB_ONE.WETH : (process.env.WETH_ADDRESS || WETH)
	const USDC_ADDR = isArbitrumOne ? ARB_ONE.USDC : (process.env.USDC_ADDRESS || USDC)
	const ROUTER_ADDR = isArbitrumOne ? ARB_ONE.SwapRouter02 : (process.env.UNISWAP_V3_ROUTER || '0x101F443B4d1b059569D643917553c771E1b9663E')

	const usdcDecimals = 6
	const tokenDecimals = 18
	const usdc = await ethers.getContractAt('IERC20', USDC_ADDR)
	const weth = await ethers.getContractAt('IERC20', WETH_ADDR)
	const router = new ethers.Contract(ROUTER_ADDR, ROUTER_ABI, signer)

	console.log('Network:', isArbitrumOne ? 'Arbitrum One' : 'Arbitrum Sepolia', '| chainId:', chainId)
	console.log('Signer:', signer.address)
	console.log('Router:', ROUTER_ADDR)
	console.log('USDC:', USDC_ADDR)
	console.log('WETH:', WETH_ADDR)
	console.log('Pool fee tier:', POOL_FEE)
	console.log('Mode:', config.mode, '| amount:', config.amountHuman)

	if (config.mode === 'buy') {
		const amountIn = ethers.parseUnits(config.amountHuman, usdcDecimals)
		const amountOutMinimum = ethers.parseUnits(config.minOutHuman, tokenDecimals)

		const balance = await usdc.balanceOf(signer.address)
		if (balance < amountIn) {
			throw new Error(`Insufficient USDC. Have: ${ethers.formatUnits(balance, usdcDecimals)}, need: ${config.amountHuman}`)
		}

		let allowance = await usdc.allowance(signer.address, ROUTER_ADDR)
		if (allowance < amountIn) {
			console.log('Approving USDC to router...')
			if (allowance !== 0n) {
				const tx0 = await usdc.connect(signer).approve(ROUTER_ADDR, 0n)
				await tx0.wait()
			}
			const txApprove = await usdc.connect(signer).approve(ROUTER_ADDR, ethers.MaxUint256)
			await txApprove.wait()
			console.log('Approved.')
		}

		// Tuple in ABI order: tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96
		const params = [
			USDC_ADDR,
			WETH_ADDR,
			POOL_FEE,
			signer.address,
			amountIn,
			amountOutMinimum,
			0n,
		]
		console.log('Swapping', config.amountHuman, 'USDC for WETH...')
		try {
			const tx = await router.exactInputSingle(params)
			const rec = await tx.wait()
			console.log('Tx hash:', rec.hash)
			console.log('WETH balance after:', ethers.formatUnits(await weth.balanceOf(signer.address), tokenDecimals))
		} catch (e) {
			console.error('Swap failed:', e.message)
			if (e.message && e.message.includes('revert')) {
				console.error('Likely cause: no liquidity in USDC/WETH pool on Arbitrum Sepolia.')
				console.error('Use swap.js with provider: "camelot" for testnet, or add liquidity to Uniswap first.')
			}
			throw e
		}
	} else {
		const amountIn = ethers.parseUnits(config.amountHuman, tokenDecimals)
		const amountOutMinimum = ethers.parseUnits(config.minOutHuman, usdcDecimals)

		const balance = await weth.balanceOf(signer.address)
		if (balance < amountIn) {
			throw new Error(`Insufficient WETH. Have: ${ethers.formatUnits(balance, tokenDecimals)}, need: ${config.amountHuman}`)
		}

		let allowance = await weth.allowance(signer.address, ROUTER_ADDR)
		if (allowance < amountIn) {
			console.log('Approving WETH to router...')
			if (allowance !== 0n) {
				const tx0 = await weth.connect(signer).approve(ROUTER_ADDR, 0n)
				await tx0.wait()
			}
			const txApprove = await weth.connect(signer).approve(ROUTER_ADDR, ethers.MaxUint256)
			await txApprove.wait()
			console.log('Approved.')
		}

		const params = [
			WETH_ADDR,
			USDC_ADDR,
			POOL_FEE,
			signer.address,
			amountIn,
			amountOutMinimum,
			0n,
		]
		console.log('Swapping', config.amountHuman, 'WETH for USDC...')
		try {
			const tx = await router.exactInputSingle(params)
			const rec = await tx.wait()
			console.log('Tx hash:', rec.hash)
			console.log('USDC balance after:', ethers.formatUnits(await usdc.balanceOf(signer.address), usdcDecimals))
		} catch (e) {
			console.error('Swap failed:', e.message)
			if (e.message && e.message.includes('revert')) {
				console.error('Likely cause: no liquidity in WETH/USDC pool on Arbitrum Sepolia.')
				console.error('Use swap.js with provider: "camelot" for testnet.')
			}
			throw e
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
