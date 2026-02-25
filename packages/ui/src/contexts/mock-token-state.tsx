import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { USER_HOLDINGS } from '@/lib/tokens'
import type { Token } from '@/lib/tokens'

type TokenHolding = { token: Token; amount: number }

type MockTokenStateContextType = {
    mockHoldings: TokenHolding[] | null
    setMockHoldings: (holdings: TokenHolding[] | null) => void
    updateTokenAmount: (symbol: string, amount: number) => void
    addToken: (token: Token, amount: number) => void
    removeToken: (symbol: string) => void
    resetToDefault: () => void
    isMocking: boolean
}

const MockTokenStateContext = createContext<MockTokenStateContextType | undefined>(undefined)

export function MockTokenStateProvider({ children }: { children: ReactNode }) {
    const [mockHoldings, setMockHoldings] = useState<TokenHolding[] | null>(null)

    const updateTokenAmount = useCallback((symbol: string, amount: number) => {
        setMockHoldings((prev) => {
            // Initialize with current holdings if not already mocking
            const holdings = prev || [...USER_HOLDINGS]
            const updated = holdings.map((h) =>
                h.token.symbol === symbol ? { ...h, amount } : h
            )
            return updated
        })
    }, [])

    const addToken = useCallback((token: Token, amount: number) => {
        setMockHoldings((prev) => {
            // Initialize with current holdings if not already mocking
            const holdings = prev || [...USER_HOLDINGS]
            // Check if token already exists
            if (holdings.some((h) => h.token.symbol === token.symbol)) {
                return holdings.map((h) =>
                    h.token.symbol === token.symbol ? { ...h, amount: h.amount + amount } : h
                )
            }
            return [...holdings, { token, amount }]
        })
    }, [])

    const removeToken = useCallback((symbol: string) => {
        setMockHoldings((prev) => {
            // Initialize with current holdings if not already mocking
            const holdings = prev || [...USER_HOLDINGS]
            const filtered = holdings.filter((h) => h.token.symbol !== symbol)
            // Don't allow removing all tokens - keep at least one
            return filtered.length === 0 ? holdings : filtered
        })
    }, [])

    const resetToDefault = useCallback(() => {
        setMockHoldings(null)
    }, [])

    const value: MockTokenStateContextType = {
        mockHoldings,
        setMockHoldings,
        updateTokenAmount,
        addToken,
        removeToken,
        resetToDefault,
        isMocking: mockHoldings !== null,
    }

    return (
        <MockTokenStateContext.Provider value={value}>
            {children}
        </MockTokenStateContext.Provider>
    )
}

export function useMockTokenState() {
    const context = useContext(MockTokenStateContext)
    if (context === undefined) {
        throw new Error('useMockTokenState must be used within MockTokenStateProvider')
    }
    return context
}

// Helper hook to get current holdings (mock or default)
// Works both inside and outside MockTokenStateProvider
export function useCurrentHoldings() {
    let holdings: TokenHolding[]
    try {
        const { mockHoldings } = useMockTokenState()
        //USER_HOLDINGS will be the list of tokens that are available to the user
        holdings = mockHoldings ?? USER_HOLDINGS
    } catch {
        // Provider not available, return default holdings
        holdings = USER_HOLDINGS
    }

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
