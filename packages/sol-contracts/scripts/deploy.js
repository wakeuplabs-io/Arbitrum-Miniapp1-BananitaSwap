const { ethers } = require('hardhat')

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

/** Get selectors for contract excluding given function names (e.g. to avoid duplicate executeBuy/executeSell). */
function getSelectorsExcept(contract, excludeNames) {
	const iface = contract.interface
	const exclude = new Set(excludeNames)
	const selectors = []
	for (const fragment of iface.fragments) {
		if (fragment.type === 'function' && !exclude.has(fragment.name)) {
			const fn = iface.getFunction(fragment.name)
			if (fn) selectors.push(fn.selector)
		}
	}
	return selectors
}

async function main() {
	const signers = await ethers.getSigners()
	const deployer = signers[0]
	if (!deployer) {
		throw new Error('No deployer account. Set PRIVATE_KEY in .env for live networks (e.g. arbitrum-sepolia).')
	}
	const network = await ethers.provider.getNetwork()
	const isArbitrumOne = Number(network.chainId) === 42161
	console.log('Deploying Diamond with account:', deployer.address, '| network:', isArbitrumOne ? 'Arbitrum One' : 'Arbitrum Sepolia')

	const usdc = process.env.USDC_ADDRESS || ethers.ZeroAddress
	const feeRecipient = process.env.FEE_RECIPIENT || deployer.address
	const feeBps = 0
	const camelotRouter = process.env.CAMELOT_ROUTER || ethers.ZeroAddress

	if (isArbitrumOne && (usdc === ethers.ZeroAddress || camelotRouter === ethers.ZeroAddress)) {
		console.log('For Arbitrum One set in .env: USDC_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831 CAMELOT_ROUTER=0x1F721E2E82F6676FCE4eA07A5958cF098D339e18')
	}

	const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet')
	const DiamondLoupeFacet = await ethers.getContractFactory('DiamondLoupeFacet')
	const OwnershipFacet = await ethers.getContractFactory('OwnershipFacet')
	const RouterFacet = await ethers.getContractFactory('RouterFacet')
	const CamelotFacet = await ethers.getContractFactory('CamelotFacet')
	const UniswapV3Facet = await ethers.getContractFactory('UniswapV3Facet')
	const DiamondInit = await ethers.getContractFactory('DiamondInit')

	const diamondCutFacet = await DiamondCutFacet.deploy()
	const diamondLoupeFacet = await DiamondLoupeFacet.deploy()
	const ownershipFacet = await OwnershipFacet.deploy()
	const routerFacet = await RouterFacet.deploy()
	const camelotFacet = await CamelotFacet.deploy()
	const uniswapV3Facet = await UniswapV3Facet.deploy()
	const diamondInit = await DiamondInit.deploy()

	await Promise.all([
		diamondCutFacet.waitForDeployment(),
		diamondLoupeFacet.waitForDeployment(),
		ownershipFacet.waitForDeployment(),
		routerFacet.waitForDeployment(),
		camelotFacet.waitForDeployment(),
		uniswapV3Facet.waitForDeployment(),
		diamondInit.waitForDeployment(),
	])

	console.log('DiamondCutFacet:', await diamondCutFacet.getAddress())
	console.log('DiamondLoupeFacet:', await diamondLoupeFacet.getAddress())
	console.log('OwnershipFacet:', await ownershipFacet.getAddress())
	console.log('RouterFacet:', await routerFacet.getAddress())
	console.log('CamelotFacet:', await camelotFacet.getAddress())
	console.log('UniswapV3Facet:', await uniswapV3Facet.getAddress())
	console.log('DiamondInit:', await diamondInit.getAddress())

	// Provider facets: Camelot is only used via delegatecall (no selectors on Diamond). UniswapV3 is added
	// only with admin selectors (setUniswapV3Router, setUniswapV3PoolFee) so owner can configure; executeBuy/executeSell
	// are shared with Camelot so not added.
	const cuts = [
		{ facetAddress: await diamondCutFacet.getAddress(), action: 0, functionSelectors: getSelectors(diamondCutFacet) },
		{ facetAddress: await diamondLoupeFacet.getAddress(), action: 0, functionSelectors: getSelectors(diamondLoupeFacet) },
		{ facetAddress: await ownershipFacet.getAddress(), action: 0, functionSelectors: getSelectors(ownershipFacet) },
		{ facetAddress: await routerFacet.getAddress(), action: 0, functionSelectors: getSelectors(routerFacet) },
		{
			facetAddress: await uniswapV3Facet.getAddress(),
			action: 0,
			functionSelectors: getSelectorsExcept(uniswapV3Facet, ['executeBuy', 'executeSell']),
		},
	]

	const initData = diamondInit.interface.encodeFunctionData('init', [usdc, feeRecipient, feeBps, camelotRouter])

	const Diamond = await ethers.getContractFactory('Diamond')
	const diamond = await Diamond.deploy(cuts, await diamondInit.getAddress(), initData)
	await diamond.waitForDeployment()

	console.log('Diamond deployed:', await diamond.getAddress())
	if (isArbitrumOne) {
		console.log('Add to .env for swap/set-provider:')
		console.log('  DIAMOND_ARB_ONE=' + (await diamond.getAddress()))
		console.log('  CAMELOT_FACET_ARB_ONE=' + (await camelotFacet.getAddress()))
		console.log('  UNISWAP_V3_FACET_ARB_ONE=' + (await uniswapV3Facet.getAddress()))
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
