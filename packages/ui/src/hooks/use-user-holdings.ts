import { useMemo } from 'react'
import type { Token } from '@/lib/tokens'
import { useMockTokenState } from '@/contexts/mock-token-state'

export type TokenHolding = { token: Token; amount: number }

/**
 * Internal hook to retrieve raw user holdings
 * TODO: Implement actual holdings retrieval logic
 * @returns Array of token holdings
 */
function useRawUserHoldings(): TokenHolding[] {
    // For now, return empty array
    // In the future, this will fetch actual user holdings
    return []
}

/**
 * Hook to get current holdings (mock or user holdings)
 * Works both inside and outside MockTokenStateProvider
 * Returns holdings with helper methods
 */
export function useUserHoldings() {
    const rawUserHoldings = useRawUserHoldings()
    let mockHoldings: TokenHolding[] | null = null
    try {
        const mockState = useMockTokenState()
        mockHoldings = mockState.mockHoldings
    } catch {
        // Provider not available
    }

    // Memoize holdings to ensure stable reference and filter out tokens with 0 amount
    const holdings = useMemo(() => {
        const allHoldings = mockHoldings ?? rawUserHoldings
        return allHoldings.filter((h) => h.amount > 0)
    }, [mockHoldings, rawUserHoldings])

    const getTokenBalance = (symbol: string, fallback?: number): number => {
        return holdings.find((h) => h.token.symbol === symbol)?.amount ?? fallback ?? 0
    }

    const getUsdcBalance = (): number => {
        return getTokenBalance('USDC')
    }

    const getNonUsdcHoldings = (): TokenHolding[] => {
        return holdings.filter((h) => h.token.symbol !== 'USDC')
    }

    const getHoldingsKey = (): string => {
        return holdings.map((h) => `${h.token.symbol}:${h.amount}`).join(',')
    }

    const getAvailableTokens = (allTokens: Token[]): Token[] => {
        return allTokens.filter((t) => !holdings.some((h) => h.token.symbol === t.symbol))
    }

    const getTotalBalanceUsd = (): number => {
        return holdings.reduce((sum, { token, amount }) => sum + amount * token.price, 0)
    }

    return {
        holdings,
        getTokenBalance,
        getUsdcBalance,
        getNonUsdcHoldings,
        getHoldingsKey,
        getAvailableTokens,
        getTotalBalanceUsd,
    }
}
