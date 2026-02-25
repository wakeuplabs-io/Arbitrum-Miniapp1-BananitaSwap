import { useQuery } from '@tanstack/react-query'
import { getTokenPairs, getTokensInfo, searchTokenPairs, type DexScreenerPair } from '@/services/dexscreener'
import type { Token } from '@/lib/tokens'

/**
 * Get the USDC token (always available as base currency)
 */
export function getUsdcToken(): Token {
    return {
        symbol: 'USDC',
        name: 'USD Coin',
        icon: 'usdc',
        logoUrl: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
        color: '#2775CA',
        price: 1.0,
        change24h: 0,
        marketCap: '$32B',
        address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        chainId: 'arbitrum',
    }
}


/**
 * Convert token pair to Token format for token-pairs endpoint
 * For token-pairs, we extract the quoteToken (the token paired with USDC)
 * Note: priceUsd in pair is for baseToken (USDC), so we'll need to fetch quoteToken price separately
 */
function pairToTokenFromTokenPairs(pair: DexScreenerPair): Token {
    // For token-pairs endpoint, baseToken is USDC, quoteToken is the token we want
    const token = pair.quoteToken
    // priceUsd in the pair is for baseToken (USDC), not quoteToken
    // We'll set price to 0 for now - could be enhanced to fetch from tokens endpoint
    const priceUsd = 0
    const change24hValue = pair.priceChange?.h24
    const change24h = typeof change24hValue === 'string'
        ? parseFloat(change24hValue)
        : change24hValue || 0
    const liquidityValue = pair.liquidity?.usd
    const liquidity = typeof liquidityValue === 'string'
        ? parseFloat(liquidityValue)
        : liquidityValue || 0
    const fdvValue = pair.fdv
    const fdv = typeof fdvValue === 'string'
        ? parseFloat(fdvValue)
        : fdvValue || 0

    // Format market cap (use FDV if available, otherwise use liquidity as approximation)
    const marketCapValue = fdv > 0 ? fdv : liquidity
    const marketCap = marketCapValue >= 1e9
        ? `$${(marketCapValue / 1e9).toFixed(1)}B`
        : marketCapValue >= 1e6
            ? `$${(marketCapValue / 1e6).toFixed(1)}M`
            : marketCapValue >= 1e3
                ? `$${(marketCapValue / 1e3).toFixed(1)}K`
                : `$${marketCapValue.toFixed(0)}`

    // Generate a color based on symbol hash for consistency
    const hashColor = (str: string) => {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash)
        }
        const hue = hash % 360
        return `hsl(${hue}, 70%, 50%)`
    }

    return {
        symbol: token.symbol,
        name: token.name,
        icon: token.symbol.toLowerCase(),
        // logoUrl omitted - TokenIcon will try multiple sources automatically from address
        color: hashColor(token.symbol),
        price: priceUsd,
        change24h,
        marketCap,
        address: token.address,
        chainId: pair.chainId,
        // Don't include dexId - we don't want to show it in listings
        pairAddress: pair.pairAddress,
    }
}

/**
 * Hook to fetch token pairs from DexScreener using the token-pairs endpoint
 * Fetches pairs for USDC token address (from env var USDC_TOKEN_ADDRESS)
 * Converts pairs to tokens, always includes USDC as the first token
 */
export function useAllTokens() {
    return useQuery({
        queryKey: ['token-pairs'],
        queryFn: async () => {
            const pairs = await getTokenPairs()
            // Convert pairs to tokens, showing only one token per address (the one with highest price)
            // For token-pairs endpoint, baseToken is USDC, quoteToken is the token we want to display
            // Use address as key (not address + dexId) to show only one token per address
            const uniquePairs = new Map<string, DexScreenerPair>()
            for (const pair of pairs) {
                const address = pair.quoteToken.address
                const addressLower = address.toLowerCase()
                const key = addressLower // Only use address, not dexId

                if (!uniquePairs.has(key)) {
                    uniquePairs.set(key, pair)
                } else {
                    // Keep the pair with higher liquidity, but strongly prefer pairs with pairAddress
                    // Note: We use liquidity here because token prices aren't available yet
                    // (they're fetched later via getTokensInfo)
                    const existing = uniquePairs.get(key)!
                    const existingLiquidity = typeof existing.liquidity?.usd === 'string'
                        ? parseFloat(existing.liquidity.usd)
                        : existing.liquidity?.usd || 0
                    const currentLiquidity = typeof pair.liquidity?.usd === 'string'
                        ? parseFloat(pair.liquidity.usd)
                        : pair.liquidity?.usd || 0

                    const hasExistingPairAddress = !!existing.pairAddress
                    const hasCurrentPairAddress = !!pair.pairAddress

                    // Strongly prefer pairs with pairAddress
                    if (hasCurrentPairAddress && !hasExistingPairAddress) {
                        // Current has pairAddress, existing doesn't - prefer current
                        uniquePairs.set(key, pair)
                    } else if (!hasCurrentPairAddress && hasExistingPairAddress) {
                        // Existing has pairAddress, current doesn't - keep existing
                        // (do nothing)
                    } else if (hasCurrentPairAddress && hasExistingPairAddress) {
                        // Both have pairAddress - prefer higher liquidity
                        if (currentLiquidity > existingLiquidity) {
                            uniquePairs.set(key, pair)
                        }
                    } else {
                        // Neither has pairAddress - prefer higher liquidity
                        if (currentLiquidity > existingLiquidity) {
                            uniquePairs.set(key, pair)
                        }
                    }
                }
            }

            // Fetch token info to get actual USD prices for quoteTokens
            const quoteTokenAddresses = Array.from(uniquePairs.values()).map(
                (pair) => pair.quoteToken.address
            )
            let tokenInfosMap = new Map<string, { priceUsd: number; priceChange24h: number }>()

            if (quoteTokenAddresses.length > 0) {
                try {
                    const tokenInfos = await getTokensInfo(quoteTokenAddresses)
                    for (const tokenInfo of tokenInfos) {
                        const address = tokenInfo.address.toLowerCase()
                        tokenInfosMap.set(address, {
                            priceUsd: tokenInfo.priceUsd,
                            priceChange24h: tokenInfo.priceChange24h,
                        })
                    }
                } catch (error) {
                    console.warn('Error fetching token info for prices:', error)
                }
            }

            // Convert pairs to tokens, using price info if available
            // After fetching prices, re-select the token with highest price for each address
            const tokensByAddress = new Map<string, Token>()
            for (const pair of uniquePairs.values()) {
                const token = pairToTokenFromTokenPairs(pair)
                const address = pair.quoteToken.address.toLowerCase()
                const tokenInfo = tokenInfosMap.get(address)
                if (tokenInfo) {
                    token.price = tokenInfo.priceUsd
                    token.change24h = tokenInfo.priceChange24h
                }
                // Store pairAddress from the pair (ensure it's preserved)
                // Don't store dexId as we don't want to show it in listings
                token.pairAddress = pair.pairAddress

                // Select the token with highest price for each address
                if (!tokensByAddress.has(address)) {
                    tokensByAddress.set(address, token)
                } else {
                    const existing = tokensByAddress.get(address)!
                    const existingPrice = existing.price || 0
                    const currentPrice = token.price || 0

                    // Prefer token with pairAddress, or higher price if both/neither have it
                    const hasExistingPairAddress = !!existing.pairAddress
                    const hasCurrentPairAddress = !!token.pairAddress

                    if (hasCurrentPairAddress && !hasExistingPairAddress) {
                        tokensByAddress.set(address, token)
                    } else if (!hasCurrentPairAddress && hasExistingPairAddress) {
                        // Keep existing
                    } else if (currentPrice > existingPrice) {
                        tokensByAddress.set(address, token)
                    }
                }
            }

            const tokens = Array.from(tokensByAddress.values())

            const usdc = getUsdcToken()

            // Ensure USDC is first and not duplicated
            const tokensWithoutUsdc = tokens.filter((t) => t.symbol !== 'USDC')
            return [usdc, ...tokensWithoutUsdc]
        },
        staleTime: 60 * 1000, // 1 minute
        refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    })
}

/**
 * Convert DexScreener pair to Token format
 * Used for search results from the search endpoint
 */
function pairToToken(pair: DexScreenerPair): Token {
    const baseToken = pair.baseToken
    const priceUsd = pair.priceUsd ? parseFloat(pair.priceUsd) : 0
    const change24hValue = pair.priceChange?.h24
    const change24h = typeof change24hValue === 'string'
        ? parseFloat(change24hValue)
        : change24hValue || 0
    const liquidityValue = pair.liquidity?.usd
    const liquidity = typeof liquidityValue === 'string'
        ? parseFloat(liquidityValue)
        : liquidityValue || 0
    const fdvValue = pair.fdv
    const fdv = typeof fdvValue === 'string'
        ? parseFloat(fdvValue)
        : fdvValue || 0

    // Format market cap (use FDV if available, otherwise use liquidity as approximation)
    const marketCapValue = fdv > 0 ? fdv : liquidity
    const marketCap = marketCapValue >= 1e9
        ? `$${(marketCapValue / 1e9).toFixed(1)}B`
        : marketCapValue >= 1e6
            ? `$${(marketCapValue / 1e6).toFixed(1)}M`
            : marketCapValue >= 1e3
                ? `$${(marketCapValue / 1e3).toFixed(1)}K`
                : `$${marketCapValue.toFixed(0)}`

    // Generate a color based on symbol hash for consistency
    const hashColor = (str: string) => {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash)
        }
        const hue = hash % 360
        return `hsl(${hue}, 70%, 50%)`
    }

    return {
        symbol: baseToken.symbol,
        name: baseToken.name,
        icon: baseToken.symbol.toLowerCase(),
        // logoUrl omitted - TokenIcon will try multiple sources automatically from address
        color: hashColor(baseToken.symbol),
        price: priceUsd,
        change24h,
        marketCap,
        address: baseToken.address,
        chainId: pair.chainId,
        // Don't include dexId - we don't want to show it in listings
        pairAddress: pair.pairAddress,
    }
}

/**
 * Hook to search for tokens on DexScreener
 * Executes search against DexScreener API when query is provided
 * Requires at least 3 characters to search
 */
export function useTokenSearch(query: string) {
    const trimmedQuery = query.trim()
    const isValidQuery = trimmedQuery.length >= 0

    return useQuery({
        queryKey: ['token-search', trimmedQuery],
        queryFn: async () => {
            if (!isValidQuery) {
                return []
            }
            const pairs = await searchTokenPairs(trimmedQuery)
            // Show only one token per address (the one with highest price)
            // Use address as key (not address + dexId) to show only one token per address
            // Note: After normalization in filterUsdcPairs, USDC is always baseToken,
            // so we extract quoteToken (the searched token) instead
            const uniqueTokens = new Map<string, DexScreenerPair>()
            for (const pair of pairs) {
                // Extract quoteToken address (the searched token, since USDC is normalized to baseToken)
                const address = pair.quoteToken.address

                const addressLower = address.toLowerCase()
                const key = addressLower // Only use address, not dexId

                if (!uniqueTokens.has(key)) {
                    uniqueTokens.set(key, pair)
                } else {
                    // Keep the pair with higher price, but strongly prefer pairs with pairAddress
                    const existing = uniqueTokens.get(key)!
                    const existingPrice = existing.priceUsd ? parseFloat(existing.priceUsd) : 0
                    const currentPrice = pair.priceUsd ? parseFloat(pair.priceUsd) : 0

                    const hasExistingPairAddress = !!existing.pairAddress
                    const hasCurrentPairAddress = !!pair.pairAddress

                    // Strongly prefer pairs with pairAddress
                    if (hasCurrentPairAddress && !hasExistingPairAddress) {
                        // Current has pairAddress, existing doesn't - prefer current
                        uniqueTokens.set(key, pair)
                    } else if (!hasCurrentPairAddress && hasExistingPairAddress) {
                        // Existing has pairAddress, current doesn't - keep existing
                        // (do nothing)
                    } else if (hasCurrentPairAddress && hasExistingPairAddress) {
                        // Both have pairAddress - prefer higher price
                        if (currentPrice > existingPrice) {
                            uniqueTokens.set(key, pair)
                        }
                    } else {
                        // Neither has pairAddress - prefer higher price
                        if (currentPrice > existingPrice) {
                            uniqueTokens.set(key, pair)
                        }
                    }
                }
            }
            // Use pairToTokenFromTokenPairs since pairs are normalized (USDC is baseToken, searched token is quoteToken)
            return Array.from(uniqueTokens.values()).map((pair) => {
                // Create a modified pair where quoteToken becomes baseToken for pairToToken
                // This way we extract the searched token (ESP) instead of USDC
                const modifiedPair = {
                    ...pair,
                    baseToken: pair.quoteToken,
                    quoteToken: pair.baseToken,
                }
                return pairToToken(modifiedPair)
            })
        },
        enabled: isValidQuery,
        staleTime: 30 * 1000, // 30 seconds
    })
}

/**
 * Hook to fetch popular tokens from DexScreener
 * @deprecated Use useAllTokens() instead and filter client-side
 */
export function usePopularTokens() {
    return useAllTokens()
}
