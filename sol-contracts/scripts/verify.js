const { ethers } = require('hardhat')
const {
	DIAMOND,
	DEPLOYER_ACCOUNT,
	DIAMOND_CUT_FACET,
	DIAMOND_LOUPE_FACET,
	OWNERSHIP_FACET,
	ROUTER_FACET,
	CAMELOT_FACET,
	DIAMOND_INIT,
} = require('./constants')

function getSelectors(contract) {
	const iface = contract.interface
	const selectors = []
	for (const fragment of iface.fragments) {
		if (fragment.type === 'function') {
			const fn = iface.getFunction(fragment.name)
			if (fn) selectors.push(fn.selector)
		}
	}
	return selectors
}

async function main() {
	require('dotenv').config()

	const usdc = process.env.USDC_ADDRESS || ethers.ZeroAddress
	const feeRecipient = process.env.FEE_RECIPIENT || DEPLOYER_ACCOUNT
	const feeBps = 0
	const camelotRouter = process.env.CAMELOT_ROUTER || ethers.ZeroAddress

	const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet')
	const DiamondLoupeFacet = await ethers.getContractFactory('DiamondLoupeFacet')
	const OwnershipFacet = await ethers.getContractFactory('OwnershipFacet')
	const RouterFacet = await ethers.getContractFactory('RouterFacet')
	const CamelotFacet = await ethers.getContractFactory('CamelotFacet')
	const DiamondInit = await ethers.getContractFactory('DiamondInit')

	const cuts = [
		{ facetAddress: DIAMOND_CUT_FACET, action: 0, functionSelectors: getSelectors(DiamondCutFacet) },
		{ facetAddress: DIAMOND_LOUPE_FACET, action: 0, functionSelectors: getSelectors(DiamondLoupeFacet) },
		{ facetAddress: OWNERSHIP_FACET, action: 0, functionSelectors: getSelectors(OwnershipFacet) },
		{ facetAddress: ROUTER_FACET, action: 0, functionSelectors: getSelectors(RouterFacet) },
		{ facetAddress: CAMELOT_FACET, action: 0, functionSelectors: getSelectors(CamelotFacet) },
	]

	const initData = DiamondInit.interface.encodeFunctionData('init', [
		usdc,
		feeRecipient,
		feeBps,
		camelotRouter,
	])

	const facetContracts = [
		{ name: 'DiamondCutFacet', address: DIAMOND_CUT_FACET, path: 'contracts/diamond/DiamondCutFacet.sol:DiamondCutFacet' },
		{ name: 'DiamondLoupeFacet', address: DIAMOND_LOUPE_FACET, path: 'contracts/diamond/DiamondLoupeFacet.sol:DiamondLoupeFacet' },
		{ name: 'OwnershipFacet', address: OWNERSHIP_FACET, path: 'contracts/diamond/OwnershipFacet.sol:OwnershipFacet' },
		{ name: 'RouterFacet', address: ROUTER_FACET, path: 'contracts/facets/RouterFacet.sol:RouterFacet' },
		{ name: 'CamelotFacet', address: CAMELOT_FACET, path: 'contracts/facets/CamelotFacet.sol:CamelotFacet' },
		{ name: 'DiamondInit', address: DIAMOND_INIT, path: 'contracts/DiamondInit.sol:DiamondInit' },
	]

	for (const { name, address, path } of facetContracts) {
		try {
			await hre.run('verify:verify', {
				address,
				contract: path,
			})
			console.log('Verified:', name)
		} catch (e) {
			if (e.message?.includes('Already Verified')) {
				console.log(name, 'already verified')
			} else {
				console.error('Verify failed for', name, e.message)
			}
		}
	}

	try {
		await hre.run('verify:verify', {
			address: DIAMOND,
			contract: 'contracts/Diamond.sol:Diamond',
			constructorArguments: [cuts, DIAMOND_INIT, initData],
		})
		console.log('Verified: Diamond')
	} catch (e) {
		if (e.message?.includes('Already Verified')) {
			console.log('Diamond already verified')
		} else {
			console.error('Verify failed for Diamond', e.message)
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
