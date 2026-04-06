/**
 * Router `provider_id` (uint8) values — must match `setAdapter(id, …)` on the deployed Diamond router.
 *
 * Keep numeric values in sync with:
 * - packages/ui/src/shared/config/router-provider-ids.ts
 */
export const ROUTER_PROVIDER_ID_CAMELOT = 1
export const ROUTER_PROVIDER_ID_UNISWAP = 2

/** Used when `dexId` is unknown or for clients that omit per-token `providerId`. */
export const ROUTER_PROVIDER_ID_DEFAULT = ROUTER_PROVIDER_ID_UNISWAP

export function routerProviderIdForDexId(dexId: string): number {
	const id = dexId.toLowerCase()
	if (id === 'camelot') return ROUTER_PROVIDER_ID_CAMELOT
	if (id === 'uniswap') return ROUTER_PROVIDER_ID_UNISWAP
	console.warn(`[router-provider-ids] Unknown dexId "${dexId}", using ROUTER_PROVIDER_ID_DEFAULT`)
	return ROUTER_PROVIDER_ID_DEFAULT
}
