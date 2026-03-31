require('dotenv').config()
require('@nomicfoundation/hardhat-ethers')
require('@nomicfoundation/hardhat-verify')

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	solidity: {
		version: '0.8.24',
		settings: {
			optimizer: { enabled: true, runs: 200 },
		},
	},
	networks: {
		hardhat: {},
		localhost: { url: 'http://127.0.0.1:8545' },
		arbitrumSepolia: {
			url: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
			chainId: 421614,
			accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
		},
		arbitrumOne: {
			url: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
			chainId: 42161,
			accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
		},
	},
	etherscan: {
		apiKey: {
			arbitrumSepolia: process.env.ARBISCAN_API_KEY || '',
			arbitrumOne: process.env.ARBISCAN_API_KEY || '',
		},
		customChains: [
			{
				network: 'arbitrumSepolia',
				chainId: 421614,
				urls: {
					apiURL: 'https://api-sepolia.arbiscan.io/api',
					browserURL: 'https://sepolia.arbiscan.io',
				},
			},
		],
	},
}
