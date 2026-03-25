/**
 * Swap via Diamond router. Addresses from constants.js (Sepolia: deployments-arbitrum-sepolia-mock.json).
 *
 *   SWAP_MODE=buy|sell  SWAP_AMOUNT=0.01  PROVIDER=uniswap
 *   npm run swap:arbitrum-sepolia
 */
require('dotenv').config()
const { ethers } = require('hardhat')
const { DIAMOND, WETH, USDC, DIAMOND_ARB_ONE, WETH_ARB_ONE, USDC_ARB_ONE } = require('./constants.js')

const IERC20_ABI = [
	'function balanceOf(address) view returns (uint256)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function approve(address spender, uint256 amount) returns (bool)',
	'function transfer(address to, uint256 amount) returns (bool)',
]
const ROUTER_FACET_ABI = [
	'function buy(address token, uint256 usdcAmount, uint256 minTokenOut, bytes32 providerId, uint256 deadline) external returns (uint256)',
	'function sell(address token, uint256 tokenAmount, uint256 minUsdcOut, bytes32 providerId, uint256 deadline) external returns (uint256)',
]

const PROVIDER_IDS = {
	camelot: ethers.keccak256(ethers.toUtf8Bytes('camelot')),
	uniswap: ethers.keccak256(ethers.toUtf8Bytes('uniswap')),
}

async function main() {
	const [signer] = await ethers.getSigners()
	if (!signer) throw new Error('No signer. Set PRIVATE_KEY in .env')

	const network = await ethers.provider.getNetwork()
	const chainId = Number(network.chainId)
	const isArbitrumOne = chainId === 42161

	const diamondAddress = isArbitrumOne ? DIAMOND_ARB_ONE : DIAMOND
	const wethAddress = isArbitrumOne ? WETH_ARB_ONE : WETH
	const usdcAddress = isArbitrumOne ? USDC_ARB_ONE : USDC
	const tokenAddress = wethAddress
	const swapMode = process.env.SWAP_MODE || 'buy'
	const amountHuman = process.env.SWAP_AMOUNT || '0.01'
	const minOutHuman = process.env.SWAP_MIN_OUT || '0'
	const providerName = process.env.PROVIDER || 'uniswap'
	// Sepolia mock: 18 decimals. Arbitrum One: USDC=6, WETH=18.
	const usdcDecimals = isArbitrumOne ? 6 : 18
	const tokenDecimals = 18

	if (!diamondAddress) {
		throw new Error(
			'Diamond not set in constants. For Sepolia mock: run npm run deploy-sepolia-mock (writes to deployments-arbitrum-sepolia-mock.json).'
		)
	}

	const diamondCode = await ethers.provider.getCode(diamondAddress)
	if (diamondCode === '0x') {
		throw new Error(`No contract at Diamond ${diamondAddress}. Check DIAMOND address.`)
	}

	const providerId = PROVIDER_IDS[providerName] ?? PROVIDER_IDS.uniswap

	const usdc = new ethers.Contract(usdcAddress, IERC20_ABI, signer)
	const token = new ethers.Contract(tokenAddress, IERC20_ABI, signer)
	const router = new ethers.Contract(diamondAddress, ROUTER_FACET_ABI, signer)
	const deadline = Math.floor(Date.now() / 1000) + 600

	async function logBalances(label) {
		const usdcBal = await usdc.balanceOf(signer.address)
		const tokenBal = await token.balanceOf(signer.address)
		console.log(
			label,
			'| USDC:',
			ethers.formatUnits(usdcBal, usdcDecimals),
			'| Token:',
			ethers.formatUnits(tokenBal, tokenDecimals)
		)
	}

	console.log('Network:', isArbitrumOne ? 'Arbitrum One' : 'Arbitrum Sepolia')
	console.log('Signer:', signer.address, '| Diamond:', diamondAddress)
	console.log('Token:', tokenAddress, '| USDC:', usdcAddress)
	console.log('Provider:', providerName, '| Mode:', swapMode, '| Amount:', amountHuman)
	await logBalances('Balances before:')

	if (swapMode === 'buy') {
		const usdcAmount = ethers.parseUnits(amountHuman, usdcDecimals)
		const minTokenOut = ethers.parseUnits(minOutHuman, tokenDecimals)
		const usdcBalance = await usdc.balanceOf(signer.address)
		if (usdcBalance < usdcAmount) {
			throw new Error(
				`Insufficient USDC. Have: ${ethers.formatUnits(usdcBalance, usdcDecimals)}, need: ${amountHuman}`
			)
		}
		let allowance = await usdc.allowance(signer.address, diamondAddress)
		if (allowance < usdcAmount) {
			console.log('Approving USDC...')
			if (allowance !== 0n) await (await usdc.approve(diamondAddress, 0n)).wait()
			await (await usdc.approve(diamondAddress, ethers.MaxUint256)).wait()
			console.log('Approved.')
		}
		console.log('Buying', amountHuman, 'USDC worth of token...')
		let tx
		try {
			tx = await router.buy(tokenAddress, usdcAmount, minTokenOut, providerId, deadline)
		} catch (err) {
			const revertReason = err.reason || err.error?.message || err.data?.message
			const revertData = err.data || err.error?.data
			let hint = ''
			if (err.message?.includes('provider not found') || revertReason?.includes('provider not found')) {
				hint = '\n  → Provider "uniswap" not registered. Use the Diamond from deploy-sepolia-mock (it has UniswapV3FacetMock).'
			} else if (revertReason?.includes('mockTokenForBuy not set') || revertReason?.includes('token mismatch')) {
				hint =
					'\n  → Use the Diamond + WETH + USDC from deploy-sepolia-mock. Real WETH (0x980B...) is not mintable.'
			} else if (revertReason) {
				hint = '\n  → ' + revertReason
			}
			if (!hint) {
				hint =
					'\n  → Run npm run deploy-sepolia-mock to create deployments-arbitrum-sepolia-mock.json. constants.js loads from that file.'
			}
			throw new Error((revertReason || err.shortMessage || err.message) + hint)
		}
		const rec = await tx.wait()
		console.log('Tx hash:', rec.hash)
		await logBalances('Balances after:')
		console.log('Buy succeeded.')
	} else if (swapMode === 'sell') {
		const tokenAmount = ethers.parseUnits(amountHuman, tokenDecimals)
		const minUsdcOut = ethers.parseUnits(minOutHuman, usdcDecimals)
		const tokenBalance = await token.balanceOf(signer.address)
		if (tokenBalance < tokenAmount) {
			throw new Error(
				`Insufficient token. Have: ${ethers.formatUnits(tokenBalance, tokenDecimals)}, need: ${amountHuman}`
			)
		}
		let allowance = await token.allowance(signer.address, diamondAddress)
		if (allowance < tokenAmount) {
			console.log('Approving token...')
			if (allowance !== 0n) await (await token.approve(diamondAddress, 0n)).wait()
			await (await token.approve(diamondAddress, ethers.MaxUint256)).wait()
			console.log('Approved.')
		}
		console.log('Selling', amountHuman, 'token...')
		const tx = await router.sell(tokenAddress, tokenAmount, minUsdcOut, providerId, deadline)
		const rec = await tx.wait()
		console.log('Tx hash:', rec.hash)
		await logBalances('Balances after:')
		console.log('Sell succeeded.')
	} else {
		throw new Error('SWAP_MODE must be "buy" or "sell"')
	}
}

main().catch((e) => {
	console.error(e.message || e)
	process.exit(1)
})
