import { createPublicClient, http } from "viem"
import { getNetworkConfig } from "./network.js"

const { chain, rpcUrl } = getNetworkConfig()

/** Shared public client for RPC calls. Uses network config (Sepolia for dev/staging, mainnet for production). */
export const publicClient = createPublicClient({
	chain,
	transport: http(rpcUrl),
})
