/**
 * Tokens API - fetches USDC-paired tokens from backend (/tokens endpoint).
 * Uses Camelot v2/v3 + Uniswap v3 subgraphs for listing, price, and liquidity.
 */
import envParsed from '@/env-parsed'

export type ApiTokenItem = {
	source: string
	dexId: string
	poolAddress: string | null
	otherToken: {
		address: string
		symbol: string
		name: string
	}
	priceUsd: number
	totalValueLockedUSD: number
	url?: string
}

export type FetchTokensResponse = {
	tokenAddresses: string[]
	tokens: ApiTokenItem[]
	fetchedAt: string
}

/**
 * Fetch USDC-paired tokens from backend.
 * Uses Camelot v2/v3 + Uniswap v3 subgraphs (aggregated by API).
 */
export async function fetchTokens(): Promise<FetchTokensResponse> {
	const res = await fetch(`${envParsed.API_URL}/tokens`)
	if (!res.ok) {
		throw new Error(`Tokens API error: ${res.status} ${res.statusText}`)
	}
	return res.json()
}
