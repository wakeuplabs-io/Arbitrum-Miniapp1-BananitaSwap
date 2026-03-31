import { arbitrum, arbitrumSepolia } from "viem/chains"

import type { Chain } from "viem"
import { env } from "./env.js"

export type NetworkConfig = {
	chain: Chain
	rpcUrl: string
	explorerUrl: string
}

const arbitrumMainnetConfig: NetworkConfig = {
	chain: arbitrum,
	rpcUrl: env.MAINNET_RPC_URL,
	explorerUrl: "https://arbiscan.io",
}

const arbitrumSepoliaConfig: NetworkConfig = {
	chain: arbitrumSepolia,
	rpcUrl: env.SEPOLIA_RPC_URL,
	explorerUrl: "https://sepolia.arbiscan.io",
}

/** App chain: Sepolia for dev/staging, mainnet for production. */
export function getNetworkConfig(): NetworkConfig {
	const isTestnet = env.IS_TESTNET
	const base = isTestnet ? arbitrumSepoliaConfig : arbitrumMainnetConfig
	const rpcUrl = isTestnet ? arbitrumSepoliaConfig.rpcUrl : arbitrumMainnetConfig.rpcUrl
	return {
		...base,
		rpcUrl,
		chain: base.chain,
	}
}
