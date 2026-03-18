/**
 * Solo aprueba USDC al Diamond. Ejecutar antes del swap si el approve no sube.
 * Uso: npx hardhat run scripts/approve-usdc.js --network arbitrumSepolia
 */
require('dotenv').config()
const { ethers } = require('hardhat')
const { DIAMOND, USDC } = require('./constants')

async function main() {
	const signers = await ethers.getSigners()
	const signer = signers[0]
	if (!signer) {
		throw new Error('No account. Set PRIVATE_KEY in .env')
	}

	const usdc = await ethers.getContractAt('IERC20', USDC)
	const diamondAddress = "0x101F443B4d1b059569D643917553c771E1b9663E"

	console.log('Signer:', signer.address)
	console.log('Diamond:', diamondAddress)
	console.log('USDC:', USDC)

	const ethBal = await ethers.provider.getBalance(signer.address)
	console.log('ETH balance (gas):', ethers.formatEther(ethBal))
	if (ethBal === 0n) {
		throw new Error('Sin ETH para gas. Consigue ETH en Arbitrum Sepolia faucet.')
	}

	const allowanceBefore = await usdc.allowance(signer.address, diamondAddress)
	console.log('Allowance actual (signer -> Diamond):', allowanceBefore.toString())

	// 1) Reset a 0 si hace falta (algunos USDC lo exigen)
	if (allowanceBefore !== 0n) {
		console.log('Enviando approve(Diamond, 0)...')
		try {
			const tx0 = await usdc.connect(signer).approve(diamondAddress, 0n)
			console.log('Tx enviada (reset 0):', tx0.hash)
			const rec0 = await tx0.wait()
			console.log('Confirmada. Block:', rec0.blockNumber)
		} catch (e) {
			console.error('Error en approve(0):', e.message)
			if (e.receipt) console.error('Receipt:', e.receipt)
			throw e
		}
	} else {
		console.log('Allowance ya es 0, sigo con approve max.')
	}

	// 2) Approve max
	console.log('Enviando approve(Diamond, MaxUint256)...')
	try {
		const tx = await usdc.connect(signer).approve(diamondAddress, ethers.MaxUint256)
		console.log('Tx enviada (approve max):', tx.hash)
		const rec = await tx.wait()
		console.log('Confirmada. Block:', rec.blockNumber)
	} catch (e) {
		console.error('Error en approve(max):', e.message)
		if (e.receipt) console.error('Receipt:', e.receipt)
		if (e.shortMessage) console.error('ShortMessage:', e.shortMessage)
		throw e
	}

	const allowanceAfter = await usdc.allowance(signer.address, diamondAddress)
	console.log('Allowance ahora:', allowanceAfter.toString())
	console.log('Listo. Puedes ejecutar el swap.')
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
