import { z } from 'zod'
import envParsed from '@/env-parsed'

const DEXSCREENER_API_BASE = 'https://api.dexscreener.com'
const CHAIN_ID = "arbitrum"

/**
 * Validate if an address is a valid Ethereum address (0x-prefixed, 42 characters)
 */
function isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * DexScreener API response schemas
 */
const PairSchema = z.object({
    chainId: z.string(),
    dexId: z.string(),
    pairAddress: z.string().optional(),
    baseToken: z.object({
        address: z.string(),
        name: z.string(),
        symbol: z.string(),
    }),
    quoteToken: z.object({
        address: z.string(),
        name: z.string(),
        symbol: z.string(),
    }),
    priceUsd: z.string().optional(),
    priceChange: z.object({
        h24: z.union([z.number(), z.string()]).optional(),
    }).optional(),
    liquidity: z.object({
        usd: z.union([z.number(), z.string()]).optional(),
    }).optional(),
    fdv: z.union([z.number(), z.string()]).optional(),
}).passthrough()

const SearchResponseSchema = z.object({
    pairs: z.array(PairSchema).nullable(),
})

// Token pairs endpoint returns an array directly, not an object
const TokenPairsResponseSchema = z.array(PairSchema)

export type DexScreenerPair = z.infer<typeof PairSchema>
export type DexScreenerSearchResponse = z.infer<typeof SearchResponseSchema>

/**
 * Check if a pair is from Arbitrum chain
 * Filters pairs to ensure only Arbitrum tokens are returned
 */
function isArbitrumPair(pair: DexScreenerPair): boolean {
    const chainId = pair.chainId?.toLowerCase() || ''
    return chainId === 'arbitrum' || chainId === 'arbitrum-one'
}

/**
 * Filter pairs to only include Arbitrum chain pairs
 */
function filterArbitrumPairs(pairs: DexScreenerPair[]): DexScreenerPair[] {
    return pairs.filter((pair) => {
        if (!isArbitrumPair(pair)) {
            return false
        }
        return true
    })
}

/**
 * Known USDC addresses on Arbitrum
 * - Native USDC: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
 * - Bridged USDC (USDC.e): 0xff970a61a04b1ca14834a43f5de4533ebddb5cc8
 */
const ARBITRUM_USDC_ADDRESSES = [
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // Native USDC
    '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', // USDC.e (bridged)
].map((addr) => addr.toLowerCase())

/**
 * Check if an address is a USDC address on Arbitrum
 */
function isUsdcAddress(address: string | undefined): boolean {
    if (!address) return false
    const addressLower = address.toLowerCase()
    return ARBITRUM_USDC_ADDRESSES.includes(addressLower)
}

/**
 * Filter pairs to only include USDC pairs (where USDC is either baseToken or quoteToken)
 * Normalizes pairs so USDC is always the baseToken for consistency
 */
function filterUsdcPairs(pairs: DexScreenerPair[]): DexScreenerPair[] {
    return pairs
        .filter((pair) => {
            const baseAddress = pair.baseToken?.address?.toLowerCase()
            const quoteAddress = pair.quoteToken?.address?.toLowerCase()
            const isUsdcBase = isUsdcAddress(pair.baseToken?.address)
            const isUsdcQuote = isUsdcAddress(pair.quoteToken?.address)
            const isUsdcPair = isUsdcBase || isUsdcQuote

            if (!isUsdcPair) {
                console.warn('[DexScreener] Filtering out non-USDC pair:', {
                    baseToken: pair.baseToken?.symbol,
                    quoteToken: pair.quoteToken?.symbol,
                    baseAddress: baseAddress,
                    quoteAddress: quoteAddress,
                })
                return false
            }
            return true
        })
        .map((pair) => {
            // Normalize pairs: if USDC is quoteToken, swap base and quote so USDC is always baseToken
            if (isUsdcAddress(pair.quoteToken?.address)) {
                // Swap base and quote tokens so USDC is always baseToken
                return {
                    ...pair,
                    baseToken: pair.quoteToken,
                    quoteToken: pair.baseToken,
                }
            }
            return pair
        })
}

export type PriceDataPoint = {
    timestamp: number
    price: number
}


/**
 * Search for token pairs on DexScreener
 * Only returns tokens from Arbitrum networks (mainnet or Sepolia)
 * Requires at least 3 characters to search
 * @param query - Search query (token name, symbol, or address)
 * @returns Array of pairs matching the query, filtered to only Arbitrum networks
 */
export async function searchTokenPairs(
    query: string
): Promise<DexScreenerPair[]> {
    const trimmedQuery = query.trim()

    // Require at least 3 characters to search
    if (!trimmedQuery || trimmedQuery.length < 3) {
        return []
    }

    try {
        const url = new URL(`${DEXSCREENER_API_BASE}/latest/dex/search`)
        url.searchParams.set('q', `arbitrum ${trimmedQuery}`)

        const response = await fetch(url.toString())

        if (!response.ok) {
            throw new Error(`DexScreener API error: ${response.statusText}`)
        }

        const data = await response.json()
        const validated = SearchResponseSchema.parse(data)

        const pairs = validated.pairs || []

        console.log('[searchTokenPairs] Raw search results:', {
            query: trimmedQuery,
            totalPairs: pairs.length,
            arbitrumPairs: pairs.filter((p) => isArbitrumPair(p)).length,
        })

        // Filter to ensure only Arbitrum pairs are returned (defense in depth)
        const arbitrumPairs = filterArbitrumPairs(pairs)

        console.log('[searchTokenPairs] After Arbitrum filter:', {
            query: trimmedQuery,
            arbitrumPairs: arbitrumPairs.length,
            pairs: arbitrumPairs.map((p) => ({
                base: p.baseToken?.symbol,
                quote: p.quoteToken?.symbol,
                chainId: p.chainId,
            })),
        })

        // Filter to ensure only USDC pairs are returned (where USDC is baseToken or quoteToken)
        let usdcPairs = filterUsdcPairs(arbitrumPairs)

        console.log('[searchTokenPairs] After USDC filter:', {
            query: trimmedQuery,
            usdcPairs: usdcPairs.length,
            pairs: usdcPairs.map((p) => ({
                base: p.baseToken?.symbol,
                quote: p.quoteToken?.symbol,
            })),
        })

        // Strategy 3: Fallback - If search didn't return USDC pairs, try to find token addresses
        // and query token-pairs endpoint directly
        if (usdcPairs.length === 0) {
            console.log('[searchTokenPairs] No USDC pairs found, trying fallback with token-pairs endpoint...')

            const tokenAddresses = new Set<string>()
            const queryLower = trimmedQuery.toLowerCase()

            // Extract token addresses from Arbitrum search results (if any)
            // Only extract addresses that match the search query symbol
            if (arbitrumPairs.length > 0) {
                for (const pair of arbitrumPairs) {
                    const baseSymbol = pair.baseToken?.symbol?.toLowerCase()
                    const quoteSymbol = pair.quoteToken?.symbol?.toLowerCase()

                    // Only add addresses that match the search query
                    if (baseSymbol === queryLower && pair.baseToken?.address && isValidEthereumAddress(pair.baseToken.address)) {
                        tokenAddresses.add(pair.baseToken.address.toLowerCase())
                    }
                    if (quoteSymbol === queryLower && pair.quoteToken?.address && isValidEthereumAddress(pair.quoteToken.address)) {
                        tokenAddresses.add(pair.quoteToken.address.toLowerCase())
                    }
                }
            }

            // Also check all search results (not just Arbitrum) to find token addresses
            // This helps when search returns pairs from other chains but we can still find the token
            // Only extract addresses that match the search query symbol
            if (tokenAddresses.size === 0 && pairs.length > 0) {
                console.log('[searchTokenPairs] No matching Arbitrum pairs found, checking all search results for matching token addresses...')

                for (const pair of pairs) {
                    // Check if the pair matches the search query (token symbol matches)
                    const baseSymbol = pair.baseToken?.symbol?.toLowerCase()
                    const quoteSymbol = pair.quoteToken?.symbol?.toLowerCase()

                    // Only extract addresses that match the search query
                    if (baseSymbol === queryLower && pair.baseToken?.address && isValidEthereumAddress(pair.baseToken.address)) {
                        tokenAddresses.add(pair.baseToken.address.toLowerCase())
                        console.log('[searchTokenPairs] Found matching token address from baseToken:', {
                            symbol: pair.baseToken.symbol,
                            address: pair.baseToken.address.toLowerCase(),
                            chainId: pair.chainId,
                        })
                    }
                    if (quoteSymbol === queryLower && pair.quoteToken?.address && isValidEthereumAddress(pair.quoteToken.address)) {
                        tokenAddresses.add(pair.quoteToken.address.toLowerCase())
                        console.log('[searchTokenPairs] Found matching token address from quoteToken:', {
                            symbol: pair.quoteToken.symbol,
                            address: pair.quoteToken.address.toLowerCase(),
                            chainId: pair.chainId,
                        })
                    }
                }
            }

            console.log('[searchTokenPairs] Found token addresses for fallback:', {
                count: tokenAddresses.size,
                addresses: Array.from(tokenAddresses),
            })

            // For each token address, query token-pairs endpoint to find USDC pairs on Arbitrum
            const fallbackPairs: DexScreenerPair[] = []
            for (const tokenAddress of tokenAddresses) {
                try {
                    const tokenPairsUrl = `${DEXSCREENER_API_BASE}/token-pairs/v1/${CHAIN_ID}/${tokenAddress}`
                    const tokenPairsResponse = await fetch(tokenPairsUrl)

                    if (tokenPairsResponse.ok) {
                        const data = await tokenPairsResponse.json()
                        const tokenPairs = TokenPairsResponseSchema.parse(data)
                        const arbitrumFiltered = filterArbitrumPairs(tokenPairs)
                        const usdcFiltered = filterUsdcPairs(arbitrumFiltered)
                        fallbackPairs.push(...usdcFiltered)
                    }
                } catch (error) {
                    console.warn('[searchTokenPairs] Error fetching token pairs for fallback:', tokenAddress, error)
                }
            }

            if (fallbackPairs.length > 0) {
                console.log('[searchTokenPairs] Fallback found USDC pairs:', {
                    count: fallbackPairs.length,
                    pairs: fallbackPairs.map((p) => ({
                        base: p.baseToken?.symbol,
                        quote: p.quoteToken?.symbol,
                    })),
                })
                usdcPairs = fallbackPairs
            }
        }

        return usdcPairs
    } catch (error) {
        console.error('Error searching token pairs:', error)
        throw error
    }
}

/**
 * Get token information using the tokens endpoint
 * Note: This endpoint actually returns pairs, not token info directly
 * We extract token info from pairs where the requested token is the baseToken
 * @param tokenAddresses - Array of token addresses to fetch
 * @returns Array of token information extracted from pairs
 */
export async function getTokensInfo(
    tokenAddresses: string[]
): Promise<Array<{ address: string; priceUsd: number; priceChange24h: number }>> {
    try {
        if (tokenAddresses.length === 0) {
            return []
        }

        const addressesParam = tokenAddresses.join(',')
        const url = `${DEXSCREENER_API_BASE}/tokens/v1/${CHAIN_ID}/${addressesParam}`

        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`DexScreener API error: ${response.statusText}`)
        }

        const data = await response.json()

        // The endpoint returns pairs, not token info
        const allPairs = TokenPairsResponseSchema.parse(data)

        // Filter to ensure only Arbitrum pairs are returned (defense in depth)
        const pairs = filterArbitrumPairs(allPairs)

        // Extract token info from pairs where the requested token is the baseToken
        // Store both price info and liquidity to pick the best pair for each token
        const tokenInfoMap = new Map<string, {
            priceUsd: number
            priceChange24h: number
            liquidity: number
        }>()
        const addressSet = new Set(tokenAddresses.map(addr => addr.toLowerCase()))

        for (const pair of pairs) {
            const baseAddress = pair.baseToken.address.toLowerCase()
            if (addressSet.has(baseAddress)) {
                // This pair has the requested token as baseToken
                const priceUsd = pair.priceUsd ? parseFloat(pair.priceUsd) : 0
                const change24hValue = pair.priceChange?.h24
                const priceChange24h = typeof change24hValue === 'string'
                    ? parseFloat(change24hValue)
                    : change24hValue || 0
                const liquidity = typeof pair.liquidity?.usd === 'string'
                    ? parseFloat(pair.liquidity.usd)
                    : pair.liquidity?.usd || 0

                // Keep the pair with highest liquidity for each token
                if (!tokenInfoMap.has(baseAddress)) {
                    tokenInfoMap.set(baseAddress, { priceUsd, priceChange24h, liquidity })
                } else {
                    const existing = tokenInfoMap.get(baseAddress)!
                    if (liquidity > existing.liquidity) {
                        tokenInfoMap.set(baseAddress, { priceUsd, priceChange24h, liquidity })
                    }
                }
            }
        }

        // Convert map to array format (remove liquidity from result)
        return Array.from(tokenInfoMap.entries()).map(([address, info]) => ({
            address,
            priceUsd: info.priceUsd,
            priceChange24h: info.priceChange24h,
        }))
    } catch (error) {
        console.error('Error fetching token info:', error)
        throw error
    }
}

/**
 * Get token pairs for a specific token address
 * Uses /token-pairs/v1/{chainId}/{tokenAddress} endpoint
 * @param tokenAddress - Token address to get pairs for (defaults to USDC_TOKEN_ADDRESS from env)
 * @returns Array of pairs for the token
 */
export async function getTokenPairs(): Promise<DexScreenerPair[]> {
    try {
        const address = envParsed.USDC_TOKEN_ADDRESS
        const url = `${DEXSCREENER_API_BASE}/token-pairs/v1/${CHAIN_ID}/${address}`

        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`DexScreener API error: ${response.statusText}`)
        }

        const data = await response.json()
        const validated = TokenPairsResponseSchema.parse(data)

        // Filter to ensure only Arbitrum pairs are returned (defense in depth)
        return filterArbitrumPairs(validated)
    } catch (error) {
        console.error('Error fetching token pairs:', error)
        throw error
    }
}
