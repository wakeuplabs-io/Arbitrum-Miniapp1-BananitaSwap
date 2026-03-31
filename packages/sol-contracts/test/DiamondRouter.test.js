const { expect } = require('chai')
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

describe('DiamondRouter', function () {
	let diamond
	let usdc
	let weth
	let mockRouter
	let owner
	let user
	const CAMELOT_PROVIDER_ID = ethers.keccak256(ethers.toUtf8Bytes('camelot'))

	before(async function () {
		const [deployer, userSigner] = await ethers.getSigners()
		owner = deployer
		user = userSigner

		const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet')
		const DiamondLoupeFacet = await ethers.getContractFactory('DiamondLoupeFacet')
		const OwnershipFacet = await ethers.getContractFactory('OwnershipFacet')
		const RouterFacet = await ethers.getContractFactory('RouterFacet')
		const CamelotFacet = await ethers.getContractFactory('CamelotFacet')
		const DiamondInit = await ethers.getContractFactory('DiamondInit')
		const MockERC20 = await ethers.getContractFactory('MockERC20')
		const MockCamelotRouter = await ethers.getContractFactory('MockCamelotRouter')

		const usdcContract = await MockERC20.deploy('USDC', 'USDC')
		const wethContract = await MockERC20.deploy('WETH', 'WETH')
		const mockRouterContract = await MockCamelotRouter.deploy()
		usdc = usdcContract
		weth = wethContract
		mockRouter = mockRouterContract

		await usdc.waitForDeployment()
		await weth.waitForDeployment()
		await mockRouter.waitForDeployment()

		const diamondCutFacet = await DiamondCutFacet.deploy()
		const diamondLoupeFacet = await DiamondLoupeFacet.deploy()
		const ownershipFacet = await OwnershipFacet.deploy()
		const routerFacetContract = await RouterFacet.deploy()
		const camelotFacet = await CamelotFacet.deploy()
		const diamondInit = await DiamondInit.deploy()

		await diamondCutFacet.waitForDeployment()
		await diamondLoupeFacet.waitForDeployment()
		await ownershipFacet.waitForDeployment()
		await routerFacetContract.waitForDeployment()
		await camelotFacet.waitForDeployment()
		await diamondInit.waitForDeployment()

		// CamelotFacet is not added to the Diamond; Router delegatecalls to its contract address
		const cuts = [
			{ facetAddress: await diamondCutFacet.getAddress(), action: 0, functionSelectors: getSelectors(diamondCutFacet) },
			{ facetAddress: await diamondLoupeFacet.getAddress(), action: 0, functionSelectors: getSelectors(diamondLoupeFacet) },
			{ facetAddress: await ownershipFacet.getAddress(), action: 0, functionSelectors: getSelectors(ownershipFacet) },
			{ facetAddress: await routerFacetContract.getAddress(), action: 0, functionSelectors: getSelectors(routerFacetContract) },
		]

		const initData = diamondInit.interface.encodeFunctionData('init', [
			await usdc.getAddress(),
			owner.address,
			0,
			await mockRouter.getAddress(),
		])

		const Diamond = await ethers.getContractFactory('Diamond')
		diamond = await Diamond.deploy(cuts, await diamondInit.getAddress(), initData)
		await diamond.waitForDeployment()

		const diamondAsRouter = await ethers.getContractAt('RouterFacet', await diamond.getAddress())
		await diamondAsRouter.setProvider(CAMELOT_PROVIDER_ID, await camelotFacet.getAddress())

		await weth.mint(await mockRouter.getAddress(), ethers.parseEther('1000'))
		await usdc.mint(user.address, ethers.parseEther('10000'))
	})

	it('should set owner after init', async function () {
		const ownership = await ethers.getContractAt('OwnershipFacet', await diamond.getAddress())
		expect(await ownership.owner()).to.equal(owner.address)
	})

	it('should return facets from loupe', async function () {
		const loupe = await ethers.getContractAt('DiamondLoupeFacet', await diamond.getAddress())
		const facets = await loupe.facets()
		expect(facets.length).to.be.gte(4)
	})

	it('should buy token (USDC -> WETH) via router', async function () {
		const amountIn = ethers.parseEther('100')
		const minOut = ethers.parseEther('0.5')
		const deadline = Math.floor(Date.now() / 1000) + 300

		await usdc.connect(user).approve(await diamond.getAddress(), amountIn)

		const diamondRouter = await ethers.getContractAt('RouterFacet', await diamond.getAddress())
		const balanceBefore = await weth.balanceOf(user.address)
		await diamondRouter.connect(user).buy(await weth.getAddress(), amountIn, minOut, CAMELOT_PROVIDER_ID, deadline)
		const balanceAfter = await weth.balanceOf(user.address)

		expect(balanceAfter - balanceBefore).to.equal(minOut)
	})

	it('should sell token (WETH -> USDC) via router', async function () {
		const amountIn = ethers.parseEther('1')
		const minOut = ethers.parseEther('50')
		const deadline = Math.floor(Date.now() / 1000) + 300

		await weth.mint(user.address, amountIn)
		await weth.connect(user).approve(await diamond.getAddress(), amountIn)

		await usdc.mint(await mockRouter.getAddress(), ethers.parseEther('100000'))

		const diamondRouter = await ethers.getContractAt('RouterFacet', await diamond.getAddress())
		const balanceBefore = await usdc.balanceOf(user.address)
		await diamondRouter.connect(user).sell(await weth.getAddress(), amountIn, minOut, CAMELOT_PROVIDER_ID, deadline)
		const balanceAfter = await usdc.balanceOf(user.address)

		expect(balanceAfter - balanceBefore).to.equal(minOut)
	})

	describe('Camelot swap', function () {
		it('should execute buy (USDC -> token) through Camelot provider', async function () {
			const amountIn = ethers.parseEther('50')
			const minTokenOut = ethers.parseEther('0.25')
			const deadline = Math.floor(Date.now() / 1000) + 300

			await usdc.connect(user).approve(await diamond.getAddress(), amountIn)

			const diamondRouter = await ethers.getContractAt('RouterFacet', await diamond.getAddress())
			const wethBefore = await weth.balanceOf(user.address)
			const usdcBefore = await usdc.balanceOf(user.address)

			const tx = await diamondRouter
				.connect(user)
				.buy(await weth.getAddress(), amountIn, minTokenOut, CAMELOT_PROVIDER_ID, deadline)
			const rec = await tx.wait()
			expect(rec.status).to.equal(1)

			const wethAfter = await weth.balanceOf(user.address)
			const usdcAfter = await usdc.balanceOf(user.address)

			expect(wethAfter - wethBefore).to.equal(minTokenOut)
			expect(usdcBefore - usdcAfter).to.equal(amountIn)
		})

		it('should execute sell (token -> USDC) through Camelot provider', async function () {
			const amountIn = ethers.parseEther('2')
			const minUsdcOut = ethers.parseEther('80')
			const deadline = Math.floor(Date.now() / 1000) + 300

			await weth.mint(user.address, amountIn)
			await weth.connect(user).approve(await diamond.getAddress(), amountIn)
			await usdc.mint(await mockRouter.getAddress(), ethers.parseEther('100000'))

			const diamondRouter = await ethers.getContractAt('RouterFacet', await diamond.getAddress())
			const usdcBefore = await usdc.balanceOf(user.address)
			const wethBefore = await weth.balanceOf(user.address)

			const tx = await diamondRouter
				.connect(user)
				.sell(await weth.getAddress(), amountIn, minUsdcOut, CAMELOT_PROVIDER_ID, deadline)
			const rec = await tx.wait()
			expect(rec.status).to.equal(1)

			const usdcAfter = await usdc.balanceOf(user.address)
			const wethAfter = await weth.balanceOf(user.address)

			expect(usdcAfter - usdcBefore).to.equal(minUsdcOut)
			expect(wethBefore - wethAfter).to.equal(amountIn)
		})
	})
})
