/**
 * Fetch USDC-paired tokens on Arbitrum.
 * Sources: Camelot v2/v3 + Uniswap v3 subgraphs (price and liquidity from subgraphs).
 * Used by GET /tokens endpoint for token listing.
 */

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
const CAMELOT_V2_SUBGRAPH = `${GRAPH_GATEWAY}/api/${GRAPH_API_KEY}/subgraphs/id/8zagLSufxk5cVhzkzai3tyABwJh53zxn9tmUYJcJxijG`
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

export type FetchUsdcPairedTokensResult = {
	tokenAddresses: string[]
	tokens: Array<{
		source: string
		dexId: string
		poolAddress: string | null
		otherToken: UsdcPairToken
		priceUsd: number
		totalValueLockedUSD: number
		url?: string
	}>
	fetchedAt: string
}

async function fetchCamelotV2UsdcPairs(
	subgraphUrl: string,
	usdcAddress: string,
	pageSize: number
): Promise<UsdcPairItem[]> {
	let skip = 0
	const out: UsdcPairItem[] = []

	while (true) {
		const query = `
			query GetPairs($usdc: Bytes!, $first: Int!, $skip: Int!) {
				pairs0: pairs(first: $first, skip: $skip, where: { token0: $usdc }, orderBy: reserveUSD, orderDirection: desc) {
					id
					token0 { id symbol name }
					token1 { id symbol name }
					reserveUSD token1Price
				}
				pairs1: pairs(first: $first, skip: $skip, where: { token1: $usdc }, orderBy: reserveUSD, orderDirection: desc) {
					id
					token0 { id symbol name }
					token1 { id symbol name }
					reserveUSD token1Price
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
			throw new Error(`Camelot v2 subgraph HTTP ${res.status}`)
		}

		const json = await res.json()
		if (json.errors) {
			throw new Error(`Camelot v2 subgraph: ${JSON.stringify(json.errors)}`)
		}

		const pairs0 = (json.data?.pairs0 ?? []) as Array<{
			id: string
			token0: { id: string; symbol: string; name: string }
			token1: { id: string; symbol: string; name: string }
			reserveUSD?: string
			token1Price?: string
		}>
		const pairs1 = (json.data?.pairs1 ?? []) as typeof pairs0
		const batch = [...pairs0, ...pairs1]

		for (const p of batch) {
			const token0 = p.token0.id.toLowerCase()
			const isUsdcToken0 = USDC_ADDRESSES.includes(token0)
			const otherToken = isUsdcToken0 ? p.token1 : p.token0
			const otherAddr = otherToken.id.toLowerCase()
			if (STABLECOIN_BLOCKLIST.has(otherAddr)) continue

			// Subgraph returns decimal-adjusted prices. token1Price = token1 per token0, token0Price = token0 per token1.
			// When USDC is token0: token1Price = other per USDC → priceUsd = 1/token1Price
			// When USDC is token1: token1Price = USDC per other → priceUsd = token1Price
			const token1PriceVal = parseFloat(p.token1Price ?? '0')
			let priceUsd = isUsdcToken0
				? (token1PriceVal > 0 ? 1 / token1PriceVal : 0)
				: token1PriceVal
			let totalValueLockedUSD = parseFloat(p.reserveUSD ?? '0')
			if (totalValueLockedUSD < MIN_TVL_USD) continue
			priceUsd = sanitizePrice(priceUsd)
			totalValueLockedUSD = sanitizeTvl(totalValueLockedUSD)

			out.push({
				source: 'camelot-v2-subgraph',
				dexId: 'camelot',
				poolAddress: p.id,
				otherToken: { address: otherToken.id, symbol: otherToken.symbol, name: otherToken.name },
				priceUsd,
				totalValueLockedUSD,
			})
		}

		if (pairs0.length < pageSize && pairs1.length < pageSize) break
		skip += pageSize
	}

	return out
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
			throw new Error(`Uniswap v3 subgraph HTTP ${res.status}`)
		}

		const json = await res.json()
		if (json.errors) {
			throw new Error(`Uniswap v3 subgraph: ${JSON.stringify(json.errors)}`)
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

function dedupeByTokenAddress(items: UsdcPairItem[]): UsdcPairItem[] {
	const map = new Map<string, UsdcPairItem>()
	for (const item of items) {
		const addr = item.otherToken.address.toLowerCase()
		const existing = map.get(addr)
		const hasPrice = item.priceUsd > 0
		const existingHasPrice = existing?.priceUsd && existing.priceUsd > 0
		const shouldReplace =
			!existing ||
			(hasPrice && !existingHasPrice) ||
			(hasPrice === existingHasPrice && item.totalValueLockedUSD > (existing?.totalValueLockedUSD ?? 0))
		if (shouldReplace) {
			map.set(addr, item)
		}
	}
	return [...map.values()]
}

/**
 * Fetch all USDC-paired tokens on Arbitrum from DexScreener + Camelot v2/v3 + Uniswap v3 subgraphs.
 * Returns deduplicated tokens with dexId and poolAddress for swap logic.
 */
export async function fetchUsdcPairedTokens(
	opts?: FetchUsdcPairedTokensOptions
): Promise<FetchUsdcPairedTokensResult> {
	const camelotOnly = opts?.camelotOnly ?? false
	const uniswapOnly = opts?.uniswapOnly ?? false

	const subgraphFetches: Promise<UsdcPairItem[]>[] = []

	if (!uniswapOnly) {
		subgraphFetches.push(
			Promise.all([
				fetchCamelotV2UsdcPairs(CAMELOT_V2_SUBGRAPH, USDC_E, PAGE_SIZE),
				fetchCamelotV2UsdcPairs(CAMELOT_V2_SUBGRAPH, USDC_NATIVE, PAGE_SIZE),
			])
				.then((r) => r.flat())
				.catch((err) => {
					console.warn('Camelot v2 subgraph failed:', (err as Error).message)
					return [] as UsdcPairItem[]
				}),
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
	const combined = dedupeByTokenAddress(subgraphPairs)

	const tokenAddresses = combined.map((x) => x.otherToken.address)
	const tokens = combined.map((t) => ({
		source: t.source,
		dexId: t.dexId,
		poolAddress: t.poolAddress,
		otherToken: t.otherToken,
		priceUsd: t.priceUsd,
		totalValueLockedUSD: t.totalValueLockedUSD,
		url: t.url,
	}))

	return {
		tokenAddresses,
		tokens,
		fetchedAt: new Date().toISOString(),
	}
}
