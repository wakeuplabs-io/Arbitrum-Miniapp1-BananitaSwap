require('dotenv').config()
const { ethers } = require('hardhat')
const {
	DIAMOND,
	WETH,
	USDC,
	DIAMOND_ARB_ONE,
	WETH_ARB_ONE,
	USDC_ARB_ONE,
} = require('./constants')

const PROVIDER_IDS = {
	camelot: ethers.keccak256(ethers.toUtf8Bytes('camelot')),
	uniswap: ethers.keccak256(ethers.toUtf8Bytes('uniswap')),
}

const config = {
	swapMode: 'buy',
	provider: 'uniswap', // 'camelot' | 'uniswap'
	tokenAddress: null,
	amountHuman: '0.01',
	minOutHuman: '0',
}

async function main() {
	const signers = await ethers.getSigners()
	const signer = signers[0]
	if (!signer) {
		throw new Error('No account. Set PRIVATE_KEY in .env')
	}

	const network = await ethers.provider.getNetwork()
	const chainId = Number(network.chainId)
	const isArbitrumOne = chainId === 42161

	const diamondAddress = isArbitrumOne ? (process.env.DIAMOND_ARB_ONE || DIAMOND_ARB_ONE) : DIAMOND
	const wethAddress = isArbitrumOne ? WETH_ARB_ONE : WETH
	const usdcAddress = isArbitrumOne ? USDC_ARB_ONE : USDC
	const tokenAddress = config.tokenAddress ?? wethAddress

	if (!diamondAddress) {
		throw new Error(
			isArbitrumOne
				? 'Set DIAMOND_ARB_ONE in .env (Diamond address from deploy on Arbitrum One)'
				: 'DIAMOND not set in constants.js'
		)
	}

	const mode = config.swapMode
	const providerId = PROVIDER_IDS[config.provider] ?? PROVIDER_IDS.camelot
	const amountHuman = config.amountHuman
	const minOutHuman = config.minOutHuman

	const usdcDecimals = 6
	const tokenDecimals = 18

	const usdc = await ethers.getContractAt('IERC20', usdcAddress)
	const token = await ethers.getContractAt('IERC20', tokenAddress)

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

	const router = await ethers.getContractAt('RouterFacet', diamondAddress)
	const deadline = Math.floor(Date.now() / 1000) + 600 // 10 min

	console.log('Network:', isArbitrumOne ? 'Arbitrum One' : 'Arbitrum Sepolia')
	console.log('Signer:', signer.address, '| Diamond:', diamondAddress)
	await logBalances('Balances before:')

	if (mode === 'buy') {
		const usdcAmount = ethers.parseUnits(amountHuman, usdcDecimals)
		const minTokenOut = ethers.parseUnits(minOutHuman, tokenDecimals)
		const usdcBalance = await usdc.balanceOf(signer.address)
		if (usdcBalance < usdcAmount) {
			throw new Error(
				`Insufficient USDC balance. Have: ${ethers.formatUnits(usdcBalance, usdcDecimals)} USDC, need: ${amountHuman} USDC. Get testnet USDC (e.g. Arbitrum Sepolia faucet) for the signer address.`
			)
		}
		const allowanceBefore = await usdc.allowance(signer.address, diamondAddress)
		console.log('USDC allowance for Diamond:', allowanceBefore.toString(), '| need:', usdcAmount.toString())
		// Always set approval for this Diamond (reset then max) so we never use allowance for a different address
		console.log('Setting USDC approval for Diamond...')
		if (allowanceBefore !== 0n) {
			const txReset = await usdc.connect(signer).approve(diamondAddress, 0n)
			await txReset.wait()
		}
		const txApprove = await usdc.connect(signer).approve(diamondAddress, ethers.MaxUint256)
		const approveRec = await txApprove.wait()
		console.log('Approval tx hash:', approveRec.hash)
		const allowanceAfter = await usdc.allowance(signer.address, diamondAddress)
		console.log('USDC allowance for Diamond now:', allowanceAfter.toString())
		if (allowanceAfter < usdcAmount) {
			throw new Error(
				`Approval failed: allowance ${allowanceAfter} < ${usdcAmount}. Check USDC contract and that signer ${signer.address} approved ${diamondAddress}.`
			)
		}
		console.log('Buying token:', tokenAddress, 'with', amountHuman, 'USDC, minOut:', minOutHuman, 'provider:', config.provider)
		const tx = await router.connect(signer).buy(
			tokenAddress,
			usdcAmount,
			minTokenOut,
			providerId,
			deadline
		)
		const rec = await tx.wait()
		console.log('Tx hash:', rec.hash)
		await logBalances('Balances after:')
		console.log('Buy succeeded. Check explorer for amount out.')
	} else if (mode === 'sell') {
		const tokenAmount = ethers.parseUnits(amountHuman, tokenDecimals)
		const minUsdcOut = ethers.parseUnits(minOutHuman, usdcDecimals)
		const tokenBalance = await token.balanceOf(signer.address)
		if (tokenBalance < tokenAmount) {
			throw new Error(
				`Insufficient token balance. Have: ${ethers.formatUnits(tokenBalance, tokenDecimals)} token, need: ${amountHuman}.`
			)
		}
		const allowanceBefore = await token.allowance(signer.address, diamondAddress)
		console.log('Token allowance for Diamond:', allowanceBefore.toString(), '| need:', tokenAmount.toString())
		console.log('Setting token approval for Diamond...')
		if (allowanceBefore !== 0n) {
			const txReset = await token.connect(signer).approve(diamondAddress, 0n)
			await txReset.wait()
		}
		const txApprove = await token.connect(signer).approve(diamondAddress, ethers.MaxUint256)
		await txApprove.wait()
		console.log('Token approved.')
		console.log('Selling token:', tokenAddress, 'amount:', amountHuman, 'minUsdcOut:', minOutHuman, 'provider:', config.provider)
		const tx = await router.connect(signer).sell(
			tokenAddress,
			tokenAmount,
			minUsdcOut,
			providerId,
			deadline
		)
		const rec = await tx.wait()
		console.log('Tx hash:', rec.hash)
		await logBalances('Balances after:')
	} else {
		throw new Error('SWAP_MODE must be "buy" or "sell"')
	}
}

main().catch((e) => {
	const msg = e.message ?? String(e)
	if (msg.includes('provider not found') || msg.includes('Router: provider not found')) {
		console.error(
			'Provider not registered on the Diamond. As owner, run:\n' +
				"  npm run set-provider:arbitrum-sepolia     # or set-provider:arbitrum-one (for 'camelot')\n" +
				"  npm run set-uniswap-provider:arbitrum-sepolia   # or set-uniswap-provider:arbitrum-one (for 'uniswap')"
		)
	} else if (msg.includes('transfer amount exceeds allowance')) {
		console.error(
			'ERC20: transfer amount exceeds allowance. Possible causes:\n' +
				'  1) User → Diamond: run the script again (it will approve the Diamond). If it still fails, check that PRIVATE_KEY is for the wallet with USDC and DIAMOND in constants.js is correct.\n' +
				'  2) Diamond → Router: if approval tx succeeded, the revert may be inside Uniswap. Ensure you ran set-uniswap-provider with UNISWAP_V3_ROUTER and UNISWAP_V3_POOL_FEE in .env.'
		)
		console.error(e)
	} else if (msg.includes('execution reverted') && config.provider === 'uniswap') {
		console.error(
			'Swap reverted (provider: uniswap). Check:\n' +
				'  1) Diamond has Uniswap config: npm run set-uniswap-provider:arbitrum-one (with UNISWAP_V3_ROUTER and UNISWAP_V3_POOL_FEE in .env).\n' +
				'  2) Or try provider: "camelot" in swap.js config (often better liquidity on Arbitrum).'
		)
		console.error(e)
	} else {
		console.error(e)
	}
	process.exit(1)
})
