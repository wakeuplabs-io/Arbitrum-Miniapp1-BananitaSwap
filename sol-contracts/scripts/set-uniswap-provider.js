require('dotenv').config()
const { ethers } = require('hardhat')
const { DIAMOND, UNISWAP_V3_FACET, DIAMOND_ARB_ONE, UNISWAP_V3_FACET_ARB_ONE } = require('./constants')

const UNISWAP_PROVIDER_ID = ethers.keccak256(ethers.toUtf8Bytes('uniswap'))

async function main() {
	const signers = await ethers.getSigners()
	const signer = signers[0]
	if (!signer) throw new Error('No account. Set PRIVATE_KEY in .env')

	const network = await ethers.provider.getNetwork()
	const isArbitrumOne = Number(network.chainId) === 42161
	const diamondAddress = isArbitrumOne ? (process.env.DIAMOND_ARB_ONE || DIAMOND_ARB_ONE) : DIAMOND
	const uniswapFacetAddress = isArbitrumOne ? (process.env.UNISWAP_V3_FACET_ARB_ONE || UNISWAP_V3_FACET_ARB_ONE) : UNISWAP_V3_FACET

	if (!diamondAddress || !uniswapFacetAddress) {
		throw new Error(
			isArbitrumOne
				? 'Set DIAMOND_ARB_ONE and UNISWAP_V3_FACET_ARB_ONE in .env (from deploy output)'
				: 'Set UNISWAP_V3_FACET in constants.js or .env'
		)
	}

	const router = await ethers.getContractAt('RouterFacet', diamondAddress)
	const uniswapFacet = await ethers.getContractAt('UniswapV3Facet', diamondAddress)

	const txProvider = await router.connect(signer).setProvider(UNISWAP_PROVIDER_ID, uniswapFacetAddress)
	await txProvider.wait()
	console.log('Registered Uniswap V3 provider:', uniswapFacetAddress)

	const uniswapRouter = process.env.UNISWAP_V3_ROUTER || (isArbitrumOne ? '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' : null)
	const poolFee = process.env.UNISWAP_V3_POOL_FEE || (isArbitrumOne ? '3000' : '')
	if (uniswapRouter) {
		const txRouter = await uniswapFacet.connect(signer).setUniswapV3Router(uniswapRouter)
		await txRouter.wait()
		console.log('Set Uniswap V3 router:', uniswapRouter)
	}
	if (poolFee !== undefined && poolFee !== '') {
		const fee = parseInt(poolFee, 10)
		const txFee = await uniswapFacet.connect(signer).setUniswapV3PoolFee(fee)
		await txFee.wait()
		console.log('Set Uniswap V3 pool fee:', fee)
	}
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
