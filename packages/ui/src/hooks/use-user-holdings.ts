import { useMemo, useCallback } from 'react'
import type { Token } from '@/lib/tokens'
import { useMockTokenState } from '@/contexts/mock-token-state'
import {
    ARBITRUM_MAINNET_USDC_ADDRESS,
    ARBITRUM_SEPOLIA_USDC_ADDRESS,
} from '@/shared/config/network'
import type { PortfolioChain } from '@/shared/config/network'
import { useOwnedTokens } from './use-owned-tokens'
import { getUsdcTokenForChain } from './use-tokens'

export type TokenHolding = { token: Token; amount: number }

/**
 * Internal hook to retrieve raw user holdings from owned tokens
 * @param chain - Which chain the balances are from (portfolio view). Default mainnet.
 */
function useRawUserHoldings(chain: PortfolioChain = 'mainnet') {
    const { data: ownedTokensData, isLoading } = useOwnedTokens(chain)

    const holdings = useMemo(() => {
        if (!ownedTokensData || !ownedTokensData.tokens || !ownedTokensData.balances) {
            return []
        }

        const holdings: TokenHolding[] = []
        const usdcToken = getUsdcTokenForChain(chain)
        const usdcAddressForLookup =
            chain === 'mainnet'
                ? ARBITRUM_MAINNET_USDC_ADDRESS.toLowerCase()
                : ARBITRUM_SEPOLIA_USDC_ADDRESS.toLowerCase()

        // Add all owned tokens (including USDC)
        for (const token of ownedTokensData.tokens) {
            const balance = ownedTokensData.balances.get(token.address?.toLowerCase() || '')
            if (balance && balance > 0) {
                holdings.push({
                    token,
                    amount: balance,
                })
            }
        }

        // Also add USDC if it's in balances but not in tokens (edge case)
        const usdcBalance = ownedTokensData.balances.get(usdcAddressForLookup)
        if (usdcBalance && usdcBalance > 0) {
            const hasUsdcInTokens = holdings.some(
                (h) => h.token.symbol === 'USDC' || h.token.address?.toLowerCase() === usdcAddressForLookup
            )
            if (!hasUsdcInTokens) {
                holdings.push({
                    token: usdcToken,
                    amount: usdcBalance,
                })
            }
        }

        return holdings
    }, [ownedTokensData, chain])

    return { holdings, isLoading }
}

/**
 * Hook to get current holdings (mock or user holdings)
 * @param chain - Which chain to show (portfolio only). Omit for default (mainnet); pass from usePortfolioChain() on portfolio screen.
 */
export function useUserHoldings(chain: PortfolioChain = 'mainnet') {
    const { holdings: rawUserHoldings, isLoading: isLoadingOwnedTokens } = useRawUserHoldings(chain)
    let mockHoldings: TokenHolding[] | null = null
    try {
        const mockState = useMockTokenState()
        mockHoldings = mockState.mockHoldings
    } catch {
        // Provider not available
    }

    // Memoize holdings to ensure stable reference and filter out tokens with 0 amount
    // Priority: Use mock holdings if available (they contain wallet tokens that can be edited)
    // Otherwise, use real holdings
    const holdings = useMemo(() => {
        const allHoldings = mockHoldings ?? rawUserHoldings
        return allHoldings.filter((h) => h.amount > 0)
    }, [mockHoldings, rawUserHoldings])

    // Loading state: true if we're loading owned tokens and not using mock data
    const isLoading = mockHoldings === null && isLoadingOwnedTokens

    // Memoize computed values
    const nonUsdcHoldings = useMemo(() => {
        return holdings.filter((h) => h.token.symbol !== 'USDC')
    }, [holdings])

    const totalBalanceUsd = useMemo(() => {
        let total = 0
        let usdcBalance = 0

        for (const holding of holdings) {
            if (holding.token.symbol === 'USDC') {
                // USDC is 1:1 with USD
                usdcBalance += holding.amount
            } else if (holding.token.price) {
                total += holding.amount * holding.token.price
            }
        }

        return total + usdcBalance
    }, [holdings])

    /**
     * Daily (24h) portfolio variance: price-only change of current basket.
     * Derived from token-level priceChange24h (DexScreener). Does not account for
     * deposits/withdrawals/swaps in the last 24h.
     */
    const dailyChangePercent = useMemo(() => {
        let total24hAgo = 0

        for (const holding of holdings) {
            if (holding.token.symbol === 'USDC') {
                total24hAgo += holding.amount
            } else if (holding.token.price != null && holding.token.price > 0) {
                const change24h = holding.token.change24h ?? 0
                const price24hAgo = change24h === -100 ? 0 : holding.token.price / (1 + change24h / 100)
                total24hAgo += holding.amount * price24hAgo
            }
        }

        if (total24hAgo === 0) return 0
        return ((totalBalanceUsd - total24hAgo) / total24hAgo) * 100
    }, [holdings, totalBalanceUsd])

    const getTokenBalance = useCallback((symbol: string, fallback?: number): number => {
        return holdings.find((h) => h.token.symbol === symbol)?.amount ?? fallback ?? 0
    }, [holdings])

    const getUsdcBalance = useCallback((): number => {
        return getTokenBalance('USDC')
    }, [getTokenBalance])

    const getHoldingsKey = useCallback((): string => {
        return holdings.map((h) => `${h.token.symbol}:${h.amount}`).join(',')
    }, [holdings])

    const getAvailableTokens = useCallback((allTokens: Token[]): Token[] => {
        return allTokens.filter((t) => !holdings.some((h) => h.token.symbol === t.symbol))
    }, [holdings])

    const getTotalBalanceUsd = useCallback((): number => {
        return totalBalanceUsd
    }, [totalBalanceUsd])

    return {
        holdings,
        nonUsdcHoldings,
        totalBalanceUsd,
        dailyChangePercent,
        isLoading,
        getTokenBalance,
        getUsdcBalance,
        getHoldingsKey,
        getAvailableTokens,
        getTotalBalanceUsd,
    }
}
