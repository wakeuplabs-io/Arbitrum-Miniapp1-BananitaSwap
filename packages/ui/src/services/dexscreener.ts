import { z } from 'zod'

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

// Token pairs endpoint returns an array directly, not an object
const TokenPairsResponseSchema = z.array(PairSchema)

export type DexScreenerPair = z.infer<typeof PairSchema>

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
const ALLOWED_DEX_IDS = ['camelot', 'uniswap']

/**
 * Filter pairs to only include allowed DEXs (Camelot)
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
			const isUsdcBase = isUsdcAddress(pair.baseToken?.address)
			const isUsdcQuote = isUsdcAddress(pair.quoteToken?.address)
			return isUsdcBase || isUsdcQuote
		})
		.map((pair) => {
			// Normalize pairs: if USDC is quoteToken, swap base and quote so USDC is always baseToken
			if (isUsdcAddress(pair.quoteToken?.address)) {
				return {
					...pair,
					baseToken: pair.quoteToken,
					quoteToken: pair.baseToken,
				}
			}
			return pair
		})
}

const GET_TOKENS_INFO_BATCH_SIZE = 25 // DexScreener limit ~30 addresses per request

export type TokenInfo = {
    address: string
    priceUsd: number
    priceChange24h: number
    fdv: number
}

/**
 * Get token information using the tokens endpoint
 * Note: This endpoint returns pairs, not token info directly.
 * Extracts token info from pairs where the requested token is baseToken or quoteToken.
 * Batches requests (DexScreener accepts ~30 addresses max per request).
 */
export async function getTokensInfo(
    tokenAddresses: string[]
): Promise<TokenInfo[]> {
    if (tokenAddresses.length === 0) return []

    const tokenInfoMap = new Map<string, { priceUsd: number; priceChange24h: number; liquidity: number; fdv: number }>()
    const addressSet = new Set(tokenAddresses.map((addr) => addr.toLowerCase()))

    const batchPromises = []
    for (let i = 0; i < tokenAddresses.length; i += GET_TOKENS_INFO_BATCH_SIZE) {
        const batch = tokenAddresses.slice(i, i + GET_TOKENS_INFO_BATCH_SIZE)
        const addressesParam = batch.join(',')
        const url = `${DEXSCREENER_API_BASE}/tokens/v1/${DEXSCREENER_CHAIN_ID}/${addressesParam}`
        batchPromises.push(
            fetch(url)
                .then(async (response) => {
                    if (!response.ok) return []
                    const data = await response.json()
                    const allPairs = TokenPairsResponseSchema.parse(data)
                    return filterArbitrumPairs(allPairs)
                })
                .catch((error) => {
                    console.warn('DexScreener getTokensInfo batch error:', error)
                    return []
                })
        )
    }

    const batchResults = await Promise.all(batchPromises)

    for (const pairs of batchResults) {
        for (const pair of pairs) {
                const baseAddress = pair.baseToken.address.toLowerCase()
                const priceUsd = pair.priceUsd ? parseFloat(pair.priceUsd) : 0
                const change24hValue = pair.priceChange?.h24
                const priceChange24h =
                    typeof change24hValue === 'string' ? parseFloat(change24hValue) : change24hValue || 0
                const liquidity =
                    typeof pair.liquidity?.usd === 'string'
                        ? parseFloat(pair.liquidity.usd)
                        : pair.liquidity?.usd || 0
                const fdvValue = pair.fdv
                const fdv = typeof fdvValue === 'string' ? parseFloat(fdvValue) : fdvValue || 0

                // priceUsd is for baseToken; when our token is quoteToken (e.g. USDC/TOKEN pair), we need quote price
                // For baseToken=USDC quoteToken=TOKEN, priceUsd≈1 (USDC) - skip, we'd need different logic
                // For baseToken=TOKEN quoteToken=USDC, priceUsd=token price - use it
                if (addressSet.has(baseAddress)) {
                    const existing = tokenInfoMap.get(baseAddress)
                    if (!existing || liquidity > existing.liquidity) {
                        tokenInfoMap.set(baseAddress, {
                            priceUsd,
                            priceChange24h,
                            liquidity,
                            fdv: fdv > 0 ? fdv : liquidity,
                        })
                    }
                }
            }
    }

    return Array.from(tokenInfoMap.entries()).map(([address, info]) => ({
        address,
        priceUsd: info.priceUsd,
        priceChange24h: info.priceChange24h,
        fdv: info.fdv,
    }))
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