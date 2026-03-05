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
	rpcUrl: "",
	explorerUrl: "https://arbiscan.io",
}

const arbitrumSepoliaConfig: NetworkConfig = {
	chain: arbitrumSepolia,
	rpcUrl: "",
	explorerUrl: "https://sepolia.arbiscan.io",
}

const NETWORK_BY_ENV: Record<string, NetworkConfig> = {
	development: arbitrumSepoliaConfig,
	staging: arbitrumSepoliaConfig,
	production: arbitrumMainnetConfig,
}

/** App chain: Sepolia for dev/staging, mainnet for production. RPC_URL must match the chain for each env. */
export function getNetworkConfig(): NetworkConfig {
	const base = NETWORK_BY_ENV[env.NODE_ENV]
	return {
		...base,
		rpcUrl: env.RPC_URL,
		chain: base.chain,
	}
}
