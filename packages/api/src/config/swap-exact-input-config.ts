/**
 * Align GET /tokens with router `exactInputSingle` (single-hop V3 pools only).
 * Keep in sync with on-chain router `getUsdc()` and UniswapV3Adapter `pool_fee`.
 */

/** Same USDC as the deployed router uses (native USDC on Arbitrum One). */
export const SWAP_LIST_ROUTER_USDC_LOWER = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'.toLowerCase()

/** Uniswap V3 fee tier (hundredths of a bip); must match UniswapV3Adapter `pool_fee`. */
export const SWAP_LIST_UNISWAP_FEE_TIER = 3000

export function getSwapRouterUsdcAddressLower(): string {
	return SWAP_LIST_ROUTER_USDC_LOWER
}

export function getSwapUniswapPoolFeeTier(): number {
	return SWAP_LIST_UNISWAP_FEE_TIER
}
