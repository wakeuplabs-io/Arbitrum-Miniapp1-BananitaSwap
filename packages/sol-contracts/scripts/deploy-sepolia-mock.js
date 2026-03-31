/**
 * Full deploy for Sepolia testing: Mock USDC, Mock WETH, Diamond with UniswapV3FacetMock.
 * Writes addresses to deployments-arbitrum-sepolia-mock.json (used by constants.js).
 *
 *   npm run deploy-sepolia-mock
 *
 * Requires: PRIVATE_KEY, ARBITRUM_SEPOLIA_RPC_URL (optional)
 */

const fs = require('fs')
const path = require('path')
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
	const [deployer] = await ethers.getSigners()
	if (!deployer) throw new Error('No deployer. Set PRIVATE_KEY in .env')

	const network = await ethers.provider.getNetwork()
	if (Number(network.chainId) !== 421614) {
		console.warn('Expected Arbitrum Sepolia (421614), got chainId', network.chainId)
	}

	console.log('Deployer:', deployer.address)

	// 1. Deploy mock tokens
	const MockERC20 = await ethers.getContractFactory('MockERC20')
	const mockUsdc = await MockERC20.deploy('Mock USDC', 'USDC')
	const mockWeth = await MockERC20.deploy('Mock WETH', 'WETH')
	await mockUsdc.waitForDeployment()
	await mockWeth.waitForDeployment()
	console.log('Mock USDC:', await mockUsdc.getAddress())
	console.log('Mock WETH:', await mockWeth.getAddress())

	await mockUsdc.mint(deployer.address, ethers.parseEther('100000'))
	await mockWeth.mint(deployer.address, ethers.parseEther('1000'))
	console.log('Minted mock tokens to deployer')

	// 2. Deploy facets (sequential to avoid nonce conflicts on live networks)
	const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet')
	const DiamondLoupeFacet = await ethers.getContractFactory('DiamondLoupeFacet')
	const OwnershipFacet = await ethers.getContractFactory('OwnershipFacet')
	const RouterFacet = await ethers.getContractFactory('RouterFacet')
	const UniswapV3FacetMock = await ethers.getContractFactory('UniswapV3FacetMock')
	const DiamondInit = await ethers.getContractFactory('DiamondInit')

	const diamondCutFacet = await DiamondCutFacet.deploy()
	await diamondCutFacet.waitForDeployment()
	const diamondLoupeFacet = await DiamondLoupeFacet.deploy()
	await diamondLoupeFacet.waitForDeployment()
	const ownershipFacet = await OwnershipFacet.deploy()
	await ownershipFacet.waitForDeployment()
	const routerFacet = await RouterFacet.deploy()
	await routerFacet.waitForDeployment()
	const uniswapV3FacetMock = await UniswapV3FacetMock.deploy()
	await uniswapV3FacetMock.waitForDeployment()
	const diamondInit = await DiamondInit.deploy()
	await diamondInit.waitForDeployment()

	console.log('UniswapV3FacetMock:', await uniswapV3FacetMock.getAddress())

	// 3. Diamond cut
	const cuts = [
		{ facetAddress: await diamondCutFacet.getAddress(), action: 0, functionSelectors: getSelectors(diamondCutFacet) },
		{ facetAddress: await diamondLoupeFacet.getAddress(), action: 0, functionSelectors: getSelectors(diamondLoupeFacet) },
		{ facetAddress: await ownershipFacet.getAddress(), action: 0, functionSelectors: getSelectors(ownershipFacet) },
		{ facetAddress: await routerFacet.getAddress(), action: 0, functionSelectors: getSelectors(routerFacet) },
		{
			facetAddress: await uniswapV3FacetMock.getAddress(),
			action: 0,
			functionSelectors: getSelectorsExcept(uniswapV3FacetMock, ['executeBuy', 'executeSell']),
		},
	]

	const initData = diamondInit.interface.encodeFunctionData('init', [
		await mockUsdc.getAddress(),
		deployer.address,
		0,
		ethers.ZeroAddress,
	])
	const Diamond = await ethers.getContractFactory('Diamond')
	const diamond = await Diamond.deploy(cuts, await diamondInit.getAddress(), initData)
	await diamond.waitForDeployment()
	const diamondAddress = await diamond.getAddress()
	console.log('Diamond:', diamondAddress)

	// 4. Register Uniswap mock provider
	const router = await ethers.getContractAt('RouterFacet', diamondAddress)
	await router.setProvider(UNISWAP_PROVIDER_ID, await uniswapV3FacetMock.getAddress())
	console.log('Registered provider uniswap -> UniswapV3FacetMock')

	// 5. Configure mock
	const diamondAsMock = await ethers.getContractAt('UniswapV3FacetMock', diamondAddress)
	await diamondAsMock.setMockTokenForBuy(await mockWeth.getAddress())
	await diamondAsMock.setMockUsdcForSell(await mockUsdc.getAddress())
	console.log('Set mockTokenForBuy: Mock WETH')
	console.log('Set mockUsdcForSell: Mock USDC')

	// 6. Whitelist token (if RouterFacet has setTokenWhitelist)
	try {
		await router.setTokenWhitelist(await mockWeth.getAddress(), true)
		console.log('Whitelisted Mock WETH')
	} catch (e) {
		console.log('setTokenWhitelist skipped (may not exist)')
	}

	// Write to deployments file (constants.js reads this)
	const deploymentsPath = path.join(__dirname, 'deployments-arbitrum-sepolia-mock.json')
	fs.writeFileSync(
		deploymentsPath,
		JSON.stringify(
			{
				diamond: diamondAddress,
				mockWeth: await mockWeth.getAddress(),
				mockUsdc: await mockUsdc.getAddress(),
			},
			null,
			2
		)
	)

	console.log('')
	console.log('--- Sepolia Mock Deploy Complete ---')
	console.log('Addresses saved to deployments-arbitrum-sepolia-mock.json')
	console.log('DIAMOND=' + diamondAddress)
	console.log('WETH=' + (await mockWeth.getAddress()))
	console.log('USDC=' + (await mockUsdc.getAddress()))
	console.log('')
	console.log('  npm run swap:arbitrum-sepolia')
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
