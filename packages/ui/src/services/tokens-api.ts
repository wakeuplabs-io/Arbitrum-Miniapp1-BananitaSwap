/**
 * Tokens API - fetches USDC-paired tokens from backend (/tokens endpoint).
 * V3 direct pools only (exactInputSingle-capable); see API `venues` per token.
 */
import envParsed from '@/env-parsed'

export type ApiSwapTokenVenue = {
	dexId: string
	providerId: number
	source: string
	poolAddress: string | null
	usdcAddress: string
	totalValueLockedUSD: number
	priceUsd: number
}

export type ApiTokenItem = {
	source: string
	dexId: string
	providerId: number
	poolAddress: string | null
	otherToken: {
		address: string
		symbol: string
		name: string
	}
	priceUsd: number
	totalValueLockedUSD: number
	url?: string
	/** Present on current API; omit on older backends. */
	venues?: ApiSwapTokenVenue[]
}

export type FetchTokensResponse = {
	tokenAddresses: string[]
	tokens: ApiTokenItem[]
	fetchedAt: string
}

/** When true (default), GET /tokens is called with `allowlist=true` (curated swap list). */
export const TOKENS_API_USE_ALLOWLIST = true

/**
 * Fetch USDC-paired tokens from backend.
 * Uses Camelot v3 + Uniswap v3 subgraphs (aggregated by API).
 */
export async function fetchTokens(options?: { allowlist?: boolean }): Promise<FetchTokensResponse> {
	const useAllowlist = options?.allowlist ?? TOKENS_API_USE_ALLOWLIST
	const params = new URLSearchParams()
	params.set('allowlist', useAllowlist ? 'true' : 'false')
	const res = await fetch(`${envParsed.API_URL}/tokens?${params.toString()}`)
	if (!res.ok) {
		throw new Error(`Tokens API error: ${res.status} ${res.statusText}`)
	}
	return res.json()
}
