import { z } from 'zod'
import envParsed from '@/env-parsed'

const DEXSCREENER_API_BASE = 'https://api.dexscreener.com'
const CHAIN_ID = "arbitrum"

/**
 * DexScreener API response schemas
 */
const PairSchema = z.object({
    chainId: z.string(),
    dexId: z.string(),
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
        url.searchParams.set('q', trimmedQuery)
        url.searchParams.set('chainIds', CHAIN_ID)

        const response = await fetch(url.toString())

        if (!response.ok) {
            throw new Error(`DexScreener API error: ${response.statusText}`)
        }

        const data = await response.json()
        const validated = SearchResponseSchema.parse(data)

        return (
            validated.pairs || []
        )
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
        const pairs = TokenPairsResponseSchema.parse(data)

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

        return validated
    } catch (error) {
        console.error('Error fetching token pairs:', error)
        throw error
    }
}
