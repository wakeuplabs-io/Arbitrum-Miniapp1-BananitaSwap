import { useMemo, useCallback } from 'react'
import type { Token } from '@/lib/tokens'
import { useMockTokenState } from '@/contexts/mock-token-state'
import { useOwnedTokens } from './use-owned-tokens'
import { getUsdcToken } from './use-tokens'

export type TokenHolding = { token: Token; amount: number }

/**
 * Internal hook to retrieve raw user holdings from owned tokens
 * Converts owned tokens data to TokenHolding format
 * @returns Array of token holdings and loading state
 */
function useRawUserHoldings() {
    const { data: ownedTokensData, isLoading } = useOwnedTokens()

    const holdings = useMemo(() => {
        if (!ownedTokensData || !ownedTokensData.tokens || !ownedTokensData.balances) {
            return []
        }

        const holdings: TokenHolding[] = []
        const usdc = getUsdcToken()

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
        const usdcBalance = ownedTokensData.balances.get(usdc.address?.toLowerCase() || '')
        if (usdcBalance && usdcBalance > 0) {
            const hasUsdcInTokens = holdings.some(
                (h) => h.token.symbol === 'USDC' || h.token.address?.toLowerCase() === usdc.address?.toLowerCase()
            )
            if (!hasUsdcInTokens) {
                holdings.push({
                    token: usdc,
                    amount: usdcBalance,
                })
            }
        }

        return holdings
    }, [ownedTokensData])

    return { holdings, isLoading }
}

/**
 * Hook to get current holdings (mock or user holdings)
 * Works both inside and outside MockTokenStateProvider
 * Returns holdings with helper methods
 */
export function useUserHoldings() {
    const { holdings: rawUserHoldings, isLoading: isLoadingOwnedTokens } = useRawUserHoldings()
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
        isLoading,
        getTokenBalance,
        getUsdcBalance,
        getHoldingsKey,
        getAvailableTokens,
        getTotalBalanceUsd,
    }
}
