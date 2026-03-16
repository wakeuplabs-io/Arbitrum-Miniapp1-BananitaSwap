require('dotenv').config()
const { ethers } = require('hardhat')
const { DIAMOND, CAMELOT_FACET, DIAMOND_ARB_ONE, CAMELOT_FACET_ARB_ONE } = require('./constants')

const CAMELOT_PROVIDER_ID = ethers.keccak256(ethers.toUtf8Bytes('camelot'))

async function main() {
	const signers = await ethers.getSigners()
	const signer = signers[0]
	if (!signer) throw new Error('No account. Set PRIVATE_KEY in .env')

	const network = await ethers.provider.getNetwork()
	const isArbitrumOne = Number(network.chainId) === 42161
	const diamondAddress = isArbitrumOne ? (process.env.DIAMOND_ARB_ONE || DIAMOND_ARB_ONE) : DIAMOND
	const camelotFacetAddress = isArbitrumOne ? (process.env.CAMELOT_FACET_ARB_ONE || CAMELOT_FACET_ARB_ONE) : CAMELOT_FACET

	if (!diamondAddress || !camelotFacetAddress) {
		throw new Error(
			isArbitrumOne
				? 'Set DIAMOND_ARB_ONE and CAMELOT_FACET_ARB_ONE in .env (from deploy output)'
				: 'DIAMOND and CAMELOT_FACET must be set in constants.js'
		)
	}

	const router = await ethers.getContractAt('RouterFacet', diamondAddress)
	const tx = await router.connect(signer).setProvider(CAMELOT_PROVIDER_ID, camelotFacetAddress)
	await tx.wait()
	console.log('Registered Camelot provider:', camelotFacetAddress)
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
