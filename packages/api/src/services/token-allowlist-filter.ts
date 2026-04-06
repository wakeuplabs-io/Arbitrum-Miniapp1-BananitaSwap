import { SWAP_TOKEN_ALLOWLIST } from '../config/swap-token-allowlist.js'
import type { FetchUsdcPairedTokensResult } from './tokens.js'

/**
 * When true (env `TOKENS_APPLY_SWAP_ALLOWLIST` or `1`), GET /tokens applies the curated allowlist
 * after the full subgraph fetch. Unset/false = full unfiltered list (existing behavior).
 */
export function isSwapTokenAllowlistEnabledFromEnv(): boolean {
	const v = process.env.TOKENS_APPLY_SWAP_ALLOWLIST?.toLowerCase()
	return v === 'true' || v === '1'
}

/**
 * Keeps only allowlisted tokens that appear in the subgraph result, in allowlist order.
 * Merges display symbol/name from the allowlist; preserves pool metadata from the fetch.
 */
export function applySwapTokenAllowlist(result: FetchUsdcPairedTokensResult): FetchUsdcPairedTokensResult {
	const byLower = new Map<string, FetchUsdcPairedTokensResult['tokens'][number]>()
	for (const t of result.tokens) {
		byLower.set(t.otherToken.address.toLowerCase(), t)
	}

	const tokens: FetchUsdcPairedTokensResult['tokens'] = []
	for (const entry of SWAP_TOKEN_ALLOWLIST) {
		const key = entry.address.toLowerCase()
		const found = byLower.get(key)
		if (!found) continue
		tokens.push({
			...found,
			otherToken: {
				address: found.otherToken.address,
				symbol: entry.symbol,
				name: entry.name,
			},
		})
	}

	return {
		tokenAddresses: tokens.map((t) => t.otherToken.address),
		tokens,
		fetchedAt: result.fetchedAt,
	}
}
