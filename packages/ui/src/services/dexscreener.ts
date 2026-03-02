import { z } from 'zod'
import { ARBITRUM_MAINNET_USDC_ADDRESS } from '@/shared/config/network'

const DEXSCREENER_API_BASE = 'https://api.dexscreener.com'
/** DexScreener only supports mainnet; always use Arbitrum mainnet for API calls */
const DEXSCREENER_CHAIN_ID = 'arbitrum'
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
 * Check if a pair is from Arbitrum chain (mainnet only; DexScreener has no testnet)
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
 * Allowed DEX IDs for token listings
 */
const ALLOWED_DEX_IDS = ['uniswap', 'camelot']

/**
 * Filter pairs to only include allowed DEXs (Uniswap or Camelot)
 */
function filterAllowedDexs(pairs: DexScreenerPair[]): DexScreenerPair[] {
    return pairs.filter((pair) => {
        const dexId = pair.dexId?.toLowerCase() || ''
        const isAllowed = ALLOWED_DEX_IDS.includes(dexId)
        if (!isAllowed) {
            return false
        }
        return true
    })
}

/**
 * Known USDC addresses on Arbitrum mainnet (DexScreener is mainnet-only)
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
            const isUsdcQuote = isUsdcAddress(pair.quoteToken?.address)

            if (!isUsdcQuote) {
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
 * Only returns tokens from Arbitrum networks
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

        const arbitrumPairs = filterArbitrumPairs(pairs)
        let usdcPairs = filterUsdcPairs(arbitrumPairs)
        usdcPairs = filterAllowedDexs(usdcPairs)

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
        const url = `${DEXSCREENER_API_BASE}/tokens/v1/${DEXSCREENER_CHAIN_ID}/${addressesParam}`

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
 * @param tokenAddress - Token address to get pairs for (mainnet USDC)
 * @returns Array of pairs for the token
 */
export async function getTokenPairs(): Promise<DexScreenerPair[]> {
    try {
        const address = ARBITRUM_MAINNET_USDC_ADDRESS
        const url = `${DEXSCREENER_API_BASE}/token-pairs/v1/${DEXSCREENER_CHAIN_ID}/${address}`

        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`DexScreener API error: ${response.statusText}`)
        }

        const data = await response.json()
        const validated = TokenPairsResponseSchema.parse(data)

        const arbitrumPairs = filterArbitrumPairs(validated)
        const usdcPairs = filterUsdcPairs(arbitrumPairs)
        const allowedDexPairs = filterAllowedDexs(usdcPairs)

        return allowedDexPairs
    } catch (error) {
        console.error('Error fetching token pairs:', error)
        throw error
    }
}

/**
 * Get token pairs for multiple token addresses
 * Fetches pairs in batches to avoid API rate limits
 * @param tokenAddresses - Array of token addresses to fetch pairs for
 * @returns Array of pairs for the tokens (filtered to USDC pairs from allowed DEXs)
 */
export async function getTokenPairsForAddresses(
    tokenAddresses: string[]
): Promise<DexScreenerPair[]> {
    if (tokenAddresses.length === 0) {
        return []
    }

    const allPairs: DexScreenerPair[] = []
    const BATCH_SIZE = 10 // Fetch in smaller batches to avoid rate limits

    for (let i = 0; i < tokenAddresses.length; i += BATCH_SIZE) {
        const batch = tokenAddresses.slice(i, i + BATCH_SIZE)

        const batchPromises = batch.map(async (address) => {
            try {
                const url = `${DEXSCREENER_API_BASE}/token-pairs/v1/${DEXSCREENER_CHAIN_ID}/${address}`
                const response = await fetch(url)

                if (!response.ok) {
                    // Silently skip addresses that don't have pairs on DexScreener
                    return []
                }

                const data = await response.json()
                const validated = TokenPairsResponseSchema.parse(data)
                const arbitrumPairs = filterArbitrumPairs(validated)
                const usdcPairs = filterUsdcPairs(arbitrumPairs)
                const allowedDexPairs = filterAllowedDexs(usdcPairs)

                return allowedDexPairs
            } catch (error) {
                // Silently skip addresses that fail (might not be on DexScreener)
                return []
            }
        })

        const batchResults = await Promise.all(batchPromises)
        allPairs.push(...batchResults.flat())
    }

    return allPairs
}