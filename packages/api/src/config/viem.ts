import { createPublicClient, http } from "viem"
import { arbitrum, arbitrumSepolia } from "viem/chains"
import { env } from "./env.js"
import { getNetworkConfig } from "./network.js"

const { chain, rpcUrl } = getNetworkConfig()

/** Shared public client for RPC calls. Uses network config (Sepolia for dev/staging, mainnet for production). */
export const publicClient = createPublicClient({
	chain,
	transport: http(rpcUrl),
})

const CHAIN_ID_TO_CHAIN = {
	[arbitrum.id]: arbitrum,
	[arbitrumSepolia.id]: arbitrumSepolia,
} as const

export function getRpcUrlForChain(chainId: number): string {
	if (chainId === arbitrumSepolia.id) {
		return env.SEPOLIA_RPC_URL
	}
	if (chainId === arbitrum.id) {
		return env.MAINNET_RPC_URL
	}
	throw new Error(`Unsupported chain ID for SIWE verification: ${chainId}`)
}

/**
 * Returns a public client for the given chain ID.
 * Use this for SIWE verification when the message's chainId may differ from the app's default chain
 * (e.g. Lemon miniapp authenticating on Arbitrum Sepolia while API is configured for mainnet).
 */
export function getPublicClientForChainId(chainId: number) {
	const chain = CHAIN_ID_TO_CHAIN[chainId as keyof typeof CHAIN_ID_TO_CHAIN]
	if (!chain) {
		throw new Error(`Unsupported chain ID: ${chainId}. Supported: ${Object.keys(CHAIN_ID_TO_CHAIN).join(", ")}`)
	}
	return createPublicClient({
		chain,
		transport: http(getRpcUrlForChain(chainId)),
	})
}
