/**
 * Router `provider_id` (uint8) — must match `setAdapter(id, …)` on the deployed Diamond router.
 *
 * Intentionally duplicated from packages/api/src/config/router-provider-ids.ts; keep both files
 * in sync when adapter IDs change on-chain.
 */
export const ROUTER_PROVIDER_ID_CAMELOT = 1
export const ROUTER_PROVIDER_ID_UNISWAP = 2

/** Fallback when a token has no per-venue `providerId` (e.g. DexScreener-only metadata). */
export const ROUTER_PROVIDER_ID_DEFAULT = ROUTER_PROVIDER_ID_UNISWAP

/** Human-readable name for UI; unknown ids still show the numeric `provider_id`. */
export function routerProviderLabel(providerId: number): string {
	if (providerId === ROUTER_PROVIDER_ID_CAMELOT) return 'Camelot'
	if (providerId === ROUTER_PROVIDER_ID_UNISWAP) return 'Uniswap'
	return `Provider ${providerId}`
}
