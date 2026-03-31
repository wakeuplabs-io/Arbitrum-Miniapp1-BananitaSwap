/**
 * Add UniswapV3FacetMock to an existing Diamond (diamond cut + setProvider + mock config).
 * Uses addresses from constants.js (deployments-arbitrum-sepolia-mock.json for Sepolia).
 *
 *   npm run set-uniswap-mock-provider:arbitrum-sepolia
 */

const { ethers } = require('hardhat')

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

const UNISWAP_PROVIDER_ID = ethers.keccak256(ethers.toUtf8Bytes('uniswap'))

async function main() {
	const { DIAMOND, WETH, USDC, DIAMOND_ARB_ONE } = require('./constants.js')
	const [deployer] = await ethers.getSigners()
	if (!deployer) throw new Error('No deployer')

	const network = await ethers.provider.getNetwork()
	const isArbitrumOne = Number(network.chainId) === 42161
	const diamondAddress = isArbitrumOne ? DIAMOND_ARB_ONE : DIAMOND
	const mockTokenForBuy = WETH
	const mockUsdc = USDC

	if (!diamondAddress) throw new Error('Diamond not set in constants')

	console.log('Diamond:', diamondAddress)
	console.log('Mock token for buy:', mockTokenForBuy)
	console.log('Mock USDC:', mockUsdc)

	const UniswapV3FacetMock = await ethers.getContractFactory('UniswapV3FacetMock')
	const mockFacet = await UniswapV3FacetMock.deploy()
	await mockFacet.waitForDeployment()
	const mockFacetAddress = await mockFacet.getAddress()
	console.log('Deployed UniswapV3FacetMock:', mockFacetAddress)

	// Admin selectors only (executeBuy/executeSell are delegatecalled via setProvider)
	const adminSelectors = getSelectorsExcept(mockFacet, ['executeBuy', 'executeSell'])

	const DiamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress)
	const cut = [{ facetAddress: mockFacetAddress, action: 0, functionSelectors: adminSelectors }]
	const txCut = await DiamondCutFacet.diamondCut(cut, ethers.ZeroAddress, '0x')
	await txCut.wait()
	console.log('Diamond cut: added UniswapV3FacetMock admin selectors')

	const ROUTER_ABI = ['function setProvider(bytes32 providerId, address facet) external']
	const router = new ethers.Contract(diamondAddress, ROUTER_ABI, deployer)
	const txProvider = await router.setProvider(UNISWAP_PROVIDER_ID, mockFacetAddress, { gasLimit: 500_000 })
	await txProvider.wait()
	console.log('Registered Uniswap provider (mock):', mockFacetAddress)

	const MOCK_ABI = [
		'function setMockTokenForBuy(address token) external',
		'function setMockUsdcForSell(address token) external',
	]
	const diamondAsMock = new ethers.Contract(diamondAddress, MOCK_ABI, deployer)
	await (await diamondAsMock.setMockTokenForBuy(mockTokenForBuy)).wait()
	await (await diamondAsMock.setMockUsdcForSell(mockUsdc)).wait()
	console.log('Set mockTokenForBuy:', mockTokenForBuy)
	console.log('Set mockUsdcForSell:', mockUsdc)

	console.log('Done. Use provider "uniswap" in swap.js to test.')
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
