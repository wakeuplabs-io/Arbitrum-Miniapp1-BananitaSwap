/**
 * Fetch USDC-paired tokens on Arbitrum for single-hop V3 swaps (exactInputSingle).
 * Sources: Camelot v3 + Uniswap v3 subgraphs. See fetchUsdcPairedTokens.
 */

import { getSwapRouterUsdcAddressLower, getSwapUniswapPoolFeeTier } from '../config/swap-exact-input-config.js'
import { routerProviderIdForDexId } from '../config/router-provider-ids.js'

const USDC_E = '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8' // USDC.e (bridged)
const USDC_NATIVE = '0xaf88d065e77c8cc2239327c5edb3a432268e5831' // Native USDC
const USDC_ADDRESSES = [USDC_E, USDC_NATIVE].map((a) => a.toLowerCase())

const STABLECOIN_BLOCKLIST = new Set([
	...USDC_ADDRESSES,
	'0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT
	'0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
].map((a) => a.toLowerCase()))

const MIN_TVL_USD = 50 // Exclude pools with <$50 TVL (unreliable prices)
const MIN_PRICE_USD = 1e-18 // Allow very small prices (e.g. RUBY ~1e-12); UI formatPrice handles display
const MAX_PRICE_USD = 1e9
const MAX_TVL_USD = 1e15

function sanitizePrice(price: number): number {
	if (!Number.isFinite(price) || price < MIN_PRICE_USD || price > MAX_PRICE_USD) return 0
	return price
}

function sanitizeTvl(tvl: number): number {
	if (!Number.isFinite(tvl) || tvl < 0 || tvl > MAX_TVL_USD) return 0
	return tvl
}

const GRAPH_API_KEY = process.env.GRAPH_API_KEY ?? 'REMOVED_GRAPH_API_KEY'
const GRAPH_GATEWAY = 'https://gateway.thegraph.com'
const CAMELOT_V3_SUBGRAPH = `${GRAPH_GATEWAY}/api/${GRAPH_API_KEY}/subgraphs/id/3utanEBA9nqMjPnuQP1vMCCys6enSM3EawBpKTVwnUw2`
const UNISWAP_V3_SUBGRAPH = `${GRAPH_GATEWAY}/api/${GRAPH_API_KEY}/subgraphs/id/FbCGRftH4a3yZugY7TnbYgPJVEv2LvMT6oF1fxPe9aJM`

export type UsdcPairToken = {
	address: string
	symbol: string
	name: string
}

export type UsdcPairItem = {
	source: string
	dexId: string
	poolAddress: string | null
	/** USDC leg of this pool (lowercase); must match router getUsdc for swaps. */
	usdcAddress: string
	otherToken: UsdcPairToken
	priceUsd: number
	totalValueLockedUSD: number
	url?: string
}

const PAGE_SIZE = 1000 // Max per subgraph request; pagination fetches all pairs for full search coverage

export type FetchUsdcPairedTokensOptions = {
	camelotOnly?: boolean
	uniswapOnly?: boolean
}

/** One direct V3 pool venue (exactInputSingle-capable for the configured adapters). */
export type SwapTokenVenue = {
	dexId: string
	providerId: number
	source: string
	poolAddress: string | null
	usdcAddress: string
	totalValueLockedUSD: number
	priceUsd: number
}

export type FetchUsdcPairedTokensResult = {
	tokenAddresses: string[]
	tokens: Array<{
		source: string
		dexId: string
		providerId: number
		poolAddress: string | null
		otherToken: UsdcPairToken
		priceUsd: number
		totalValueLockedUSD: number
		url?: string
		venues: SwapTokenVenue[]
	}>
	fetchedAt: string
}

async function fetchCamelotV3UsdcPools(
	subgraphUrl: string,
	usdcAddress: string,
	pageSize: number
): Promise<UsdcPairItem[]> {
	let skip = 0
	const out: UsdcPairItem[] = []

	while (true) {
		const query = `
			query GetPools($usdc: Bytes!, $first: Int!, $skip: Int!) {
				pools0: pools(first: $first, skip: $skip, where: { token0: $usdc }, orderBy: totalValueLockedUSD, orderDirection: desc) {
					id
					token0 { id symbol name }
					token1 { id symbol name }
					token1Price totalValueLockedUSD
				}
				pools1: pools(first: $first, skip: $skip, where: { token1: $usdc }, orderBy: totalValueLockedUSD, orderDirection: desc) {
					id
					token0 { id symbol name }
					token1 { id symbol name }
					token1Price totalValueLockedUSD
				}
			}
		`

		const res = await fetch(subgraphUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query,
				variables: {
					usdc: usdcAddress,
					first: pageSize,
					skip,
				},
			}),
		})

		if (!res.ok) {
			throw new Error(`Camelot v3 subgraph HTTP ${res.status}`)
		}

		const json = await res.json()
		if (json.errors) {
			throw new Error(`Camelot v3 subgraph: ${JSON.stringify(json.errors)}`)
		}

		const pools0 = (json.data?.pools0 ?? []) as Array<{
			id: string
			token0: { id: string; symbol: string; name: string }
			token1: { id: string; symbol: string; name: string }
			token1Price?: string
			totalValueLockedUSD?: string
		}>
		const pools1 = (json.data?.pools1 ?? []) as typeof pools0
		const batch = [...pools0, ...pools1]

		for (const p of batch) {
			const token0 = p.token0.id.toLowerCase()
			const isUsdcToken0 = USDC_ADDRESSES.includes(token0)
			const otherToken = isUsdcToken0 ? p.token1 : p.token0
			const otherAddr = otherToken.id.toLowerCase()
			if (STABLECOIN_BLOCKLIST.has(otherAddr)) continue

			// Same semantics: token1Price = token1 per token0. When USDC is token1, token1Price = USDC per other.
			const token1PriceVal = parseFloat(p.token1Price ?? '0')
			let priceUsd = isUsdcToken0
				? (token1PriceVal > 0 ? 1 / token1PriceVal : 0)
				: token1PriceVal
			let totalValueLockedUSD = parseFloat(p.totalValueLockedUSD ?? '0')
			if (totalValueLockedUSD < MIN_TVL_USD) continue
			priceUsd = sanitizePrice(priceUsd)
			totalValueLockedUSD = sanitizeTvl(totalValueLockedUSD)

			out.push({
				source: 'camelot-v3-subgraph',
				dexId: 'camelot',
				poolAddress: p.id,
				usdcAddress: usdcAddress.toLowerCase(),
				otherToken: { address: otherToken.id, symbol: otherToken.symbol, name: otherToken.name },
				priceUsd,
				totalValueLockedUSD,
			})
		}

		if (pools0.length < pageSize && pools1.length < pageSize) break
		skip += pageSize
	}

	return out
}

async function fetchUniswapV3UsdcPools(
	subgraphUrl: string,
	usdcAddress: string,
	pageSize: number
): Promise<UsdcPairItem[]> {
	const requiredFeeTier = getSwapUniswapPoolFeeTier()
	let skip = 0
	const out: UsdcPairItem[] = []

	while (true) {
		const query = `
			query GetPools($usdc: Bytes!, $first: Int!, $skip: Int!) {
				pools0: pools(first: $first, skip: $skip, where: { token0: $usdc }, orderBy: totalValueLockedUSD, orderDirection: desc) {
					id
					feeTier
					token0 { id symbol name }
					token1 { id symbol name }
					token1Price totalValueLockedUSD
				}
				pools1: pools(first: $first, skip: $skip, where: { token1: $usdc }, orderBy: totalValueLockedUSD, orderDirection: desc) {
					id
					feeTier
					token0 { id symbol name }
					token1 { id symbol name }
					token1Price totalValueLockedUSD
				}
			}
		`

		const res = await fetch(subgraphUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query,
				variables: {
					usdc: usdcAddress,
					first: pageSize,
					skip,
				},
			}),
		})

		if (!res.ok) {
			throw new Error(`Uniswap v3 subgraph HTTP ${res.status}`)
		}

		const json = await res.json()
		if (json.errors) {
			throw new Error(`Uniswap v3 subgraph: ${JSON.stringify(json.errors)}`)
		}

		const pools0 = (json.data?.pools0 ?? []) as Array<{
			id: string
			feeTier?: string | number
			token0: { id: string; symbol: string; name: string }
			token1: { id: string; symbol: string; name: string }
			token1Price?: string
			totalValueLockedUSD?: string
		}>
		const pools1 = (json.data?.pools1 ?? []) as typeof pools0
		const batch = [...pools0, ...pools1]

		for (const p of batch) {
			const feeTier = Number(p.feeTier)
			if (!Number.isFinite(feeTier) || feeTier !== requiredFeeTier) continue

			const token0 = p.token0.id.toLowerCase()
			const isUsdcToken0 = USDC_ADDRESSES.includes(token0)
			const otherToken = isUsdcToken0 ? p.token1 : p.token0
			const otherAddr = otherToken.id.toLowerCase()
			if (STABLECOIN_BLOCKLIST.has(otherAddr)) continue

			const token1PriceVal = parseFloat(p.token1Price ?? '0')
			let priceUsd = isUsdcToken0
				? (token1PriceVal > 0 ? 1 / token1PriceVal : 0)
				: token1PriceVal
			let totalValueLockedUSD = parseFloat(p.totalValueLockedUSD ?? '0')
			if (totalValueLockedUSD < MIN_TVL_USD) continue
			priceUsd = sanitizePrice(priceUsd)
			totalValueLockedUSD = sanitizeTvl(totalValueLockedUSD)

			out.push({
				source: 'uniswap-v3-subgraph',
				dexId: 'uniswap',
				poolAddress: p.id,
				usdcAddress: usdcAddress.toLowerCase(),
				otherToken: { address: otherToken.id, symbol: otherToken.symbol, name: otherToken.name },
				priceUsd,
				totalValueLockedUSD,
			})
		}

		if (pools0.length < pageSize && pools1.length < pageSize) break
		skip += pageSize
	}

	return out
}

function filterByRouterUsdc(items: UsdcPairItem[], routerUsdcLower: string): UsdcPairItem[] {
	return items.filter((i) => i.usdcAddress === routerUsdcLower)
}

function mergeItemsToTokensWithVenues(items: UsdcPairItem[]): FetchUsdcPairedTokensResult['tokens'] {
	const byAddr = new Map<string, UsdcPairItem[]>()
	for (const item of items) {
		const k = item.otherToken.address.toLowerCase()
		const arr = byAddr.get(k) ?? []
		arr.push(item)
		byAddr.set(k, arr)
	}

	const tokens: FetchUsdcPairedTokensResult['tokens'] = []
	for (const group of byAddr.values()) {
		group.sort((a, b) => b.totalValueLockedUSD - a.totalValueLockedUSD)
		const primary = group[0]!
		const venues: SwapTokenVenue[] = group.map((v) => ({
			dexId: v.dexId,
			providerId: routerProviderIdForDexId(v.dexId),
			source: v.source,
			poolAddress: v.poolAddress,
			usdcAddress: v.usdcAddress,
			totalValueLockedUSD: v.totalValueLockedUSD,
			priceUsd: v.priceUsd,
		}))

		tokens.push({
			source: primary.source,
			dexId: primary.dexId,
			providerId: routerProviderIdForDexId(primary.dexId),
			poolAddress: primary.poolAddress,
			otherToken: primary.otherToken,
			priceUsd: primary.priceUsd,
			totalValueLockedUSD: primary.totalValueLockedUSD,
			url: primary.url,
			venues,
		})
	}

	tokens.sort((a, b) => b.totalValueLockedUSD - a.totalValueLockedUSD)
	return tokens
}

/**
 * Fetch USDC–token pairs suitable for router `exactInputSingle` (single-hop V3 only).
 * - Camelot: Camelot V3 subgraph only (not V2; not Camelot UI aggregator paths).
 * - Uniswap: Uniswap V3 pools whose feeTier matches swap-exact-input-config (default 3000).
 * - Only pools whose USDC leg equals swap-exact-input-config router USDC (native Arbitrum USDC).
 * Each token includes `venues` (all qualifying pools) plus primary fields from highest TVL venue.
 */
export async function fetchUsdcPairedTokens(
	opts?: FetchUsdcPairedTokensOptions
): Promise<FetchUsdcPairedTokensResult> {
	const camelotOnly = opts?.camelotOnly ?? false
	const uniswapOnly = opts?.uniswapOnly ?? false
	const routerUsdcLower = getSwapRouterUsdcAddressLower()

	const subgraphFetches: Promise<UsdcPairItem[]>[] = []

	if (!uniswapOnly) {
		subgraphFetches.push(
			Promise.all([
				fetchCamelotV3UsdcPools(CAMELOT_V3_SUBGRAPH, USDC_E, PAGE_SIZE),
				fetchCamelotV3UsdcPools(CAMELOT_V3_SUBGRAPH, USDC_NATIVE, PAGE_SIZE),
			])
				.then((r) => r.flat())
				.catch((err) => {
					console.warn('Camelot v3 subgraph failed:', (err as Error).message)
					return [] as UsdcPairItem[]
				})
		)
	}

	if (uniswapOnly || !camelotOnly) {
		subgraphFetches.push(
			Promise.all([
				fetchUniswapV3UsdcPools(UNISWAP_V3_SUBGRAPH, USDC_E, PAGE_SIZE),
				fetchUniswapV3UsdcPools(UNISWAP_V3_SUBGRAPH, USDC_NATIVE, PAGE_SIZE),
			])
				.then((r) => r.flat())
				.catch((err) => {
					console.warn('Uniswap v3 subgraph failed:', (err as Error).message)
					return [] as UsdcPairItem[]
				})
		)
	}

	const subgraphResults = await Promise.all(subgraphFetches)
	const subgraphPairs = subgraphResults.flat()
	const forRouter = filterByRouterUsdc(subgraphPairs, routerUsdcLower)
	const tokens = mergeItemsToTokensWithVenues(forRouter)
	const tokenAddresses = tokens.map((x) => x.otherToken.address)

	return {
		tokenAddresses,
		tokens,
		fetchedAt: new Date().toISOString(),
	}
}
