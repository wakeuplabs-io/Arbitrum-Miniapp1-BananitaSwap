import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import type { Token } from '@/lib/tokens'
import { useUserHoldings, type TokenHolding } from '@/hooks/use-user-holdings'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
import { useOwnedTokens } from '@/hooks/use-owned-tokens'
import { getUsdcToken } from '@/hooks/use-tokens'

type MockTokenStateContextType = {
    mockHoldings: TokenHolding[] | null
    setMockHoldings: (holdings: TokenHolding[] | null) => void
    updateTokenAmount: (symbol: string, amount: number) => void
    addToken: (token: Token, amount: number) => void
    removeToken: (symbol: string) => void
    resetToDefault: () => void
    deposit: (amount: number, symbol: string) => Promise<void>
    withdraw: (amount: number, symbol: string) => Promise<void>
    swap: (sellTokenSymbol: string, buyTokenSymbol: string, sellAmount: number, buyAmount: number, buyToken?: Token) => Promise<void>
    isMocking: boolean
}

const MockTokenStateContext = createContext<MockTokenStateContextType | undefined>(undefined)

export function MockTokenStateProvider({ children }: { children: ReactNode }) {
    const [mockHoldings, setMockHoldings] = useState<TokenHolding[] | null>(null)
    const { holdings: userHoldings } = useUserHoldings()
    const { wallet } = useLemonMiniapp()
    const { data: ownedTokensData, isLoading: isLoadingOwnedTokens } = useOwnedTokens()
    const lastWalletRef = useRef<string | undefined>(undefined)

    // When wallet address is set and holdings are loaded, copy them to mock holdings
    useEffect(() => {
        const hasValidWallet = wallet && wallet !== 'undefined' && wallet.trim() !== ''
        const walletChanged = wallet !== lastWalletRef.current

        if (hasValidWallet && !isLoadingOwnedTokens && ownedTokensData) {
            // Only sync if wallet changed (to avoid overwriting user edits)
            if (walletChanged) {
                const holdings: TokenHolding[] = []
                const usdc = getUsdcToken()

                // Add all owned tokens (including USDC)
                if (ownedTokensData.tokens && ownedTokensData.balances) {
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

                    // Copy holdings to mock state so they can be edited
                    if (holdings.length > 0) {
                        setMockHoldings(holdings.filter((h) => h.amount > 0))
                    } else {
                        // If no holdings found, clear mock holdings
                        setMockHoldings(null)
                    }
                }
            }
        } else if (!hasValidWallet && walletChanged) {
            // Wallet was cleared, reset mock holdings
            setMockHoldings(null)
        }

        lastWalletRef.current = wallet
    }, [wallet, ownedTokensData, isLoadingOwnedTokens])

    const updateTokenAmount = useCallback((symbol: string, amount: number) => {
        setMockHoldings((prev) => {
            // Initialize with current holdings if not already mocking
            const holdings = prev || [...userHoldings]
            const updated = holdings.map((h) =>
                h.token.symbol === symbol ? { ...h, amount } : h
            )
            return updated
        })
    }, [userHoldings])

    const addToken = useCallback((token: Token, amount: number) => {
        setMockHoldings((prev) => {
            // Initialize with current holdings if not already mocking
            const holdings = prev || [...userHoldings]
            // Check if token already exists
            if (holdings.some((h) => h.token.symbol === token.symbol)) {
                return holdings.map((h) =>
                    h.token.symbol === token.symbol ? { ...h, amount: h.amount + amount } : h
                )
            }
            return [...holdings, { token, amount }]
        })
    }, [userHoldings])

    const removeToken = useCallback((symbol: string) => {
        setMockHoldings((prev) => {
            // Initialize with current holdings if not already mocking
            const holdings = prev || [...userHoldings]
            const filtered = holdings.filter((h) => h.token.symbol !== symbol)
            // When mocking (prev !== null), allow removing all tokens including the last one
            // When not mocking (prev === null), keep at least one token
            // Note: The button is already disabled when !isMocking && holdings.length === 1,
            // so this check is a safety measure
            if (prev === null && filtered.length === 0) {
                // Not mocking and trying to remove last token - prevent it
                return holdings
            }
            // Mocking mode (prev !== null) - allow removing all tokens, or has remaining tokens
            return filtered
        })
    }, [userHoldings])

    const resetToDefault = useCallback(() => {
        setMockHoldings(null)
    }, [])

    const deposit = useCallback(async (amount: number, symbol: string) => {
        setMockHoldings((prev) => {
            const holdings = prev || [...userHoldings]
            const existingHolding = holdings.find((h) => h.token.symbol === symbol)
            if (existingHolding) {
                return holdings.map((h) =>
                    h.token.symbol === symbol ? { ...h, amount: h.amount + amount } : h
                )
            }
            return holdings
        })
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 500))
    }, [userHoldings])

    const withdraw = useCallback(async (amount: number, symbol: string) => {
        setMockHoldings((prev) => {
            const holdings = prev || [...userHoldings]
            const existingHolding = holdings.find((h) => h.token.symbol === symbol)
            if (existingHolding && existingHolding.amount >= amount) {
                const updatedAmount = existingHolding.amount - amount
                return holdings.map((h) =>
                    h.token.symbol === symbol ? { ...h, amount: updatedAmount } : h
                )
            }
            throw new Error(`Insufficient ${symbol} balance`)
        })
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 500))
    }, [userHoldings])

    const swap = useCallback(async (sellTokenSymbol: string, buyTokenSymbol: string, sellAmount: number, buyAmount: number, buyToken?: Token) => {
        setMockHoldings((prev) => {
            const holdings = prev || [...userHoldings]

            // Find sell token holding
            const sellHolding = holdings.find((h) => h.token.symbol === sellTokenSymbol)
            if (!sellHolding || sellHolding.amount < sellAmount) {
                throw new Error(`Insufficient ${sellTokenSymbol} balance`)
            }

            // Find buy token holding
            const buyHolding = holdings.find((h) => h.token.symbol === buyTokenSymbol)

            // Update holdings: subtract from sell token
            let updatedHoldings = holdings.map((h) => {
                if (h.token.symbol === sellTokenSymbol) {
                    return { ...h, amount: h.amount - sellAmount }
                }
                return h
            })

            if (buyHolding) {
                // Update existing buy token holding
                updatedHoldings = updatedHoldings.map((h) =>
                    h.token.symbol === buyTokenSymbol ? { ...h, amount: h.amount + buyAmount } : h
                )
            } else if (buyToken) {
                // Add new token if it doesn't exist and we have the token object
                updatedHoldings = [...updatedHoldings, { token: buyToken, amount: buyAmount }]
            } else {
                // If token doesn't exist and we don't have the token object, we can't add it
                throw new Error(`Token ${buyTokenSymbol} not found in holdings. Please add it first.`)
            }

            return updatedHoldings
        })
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 500))
    }, [userHoldings])

    const value: MockTokenStateContextType = {
        mockHoldings,
        setMockHoldings,
        updateTokenAmount,
        addToken,
        removeToken,
        resetToDefault,
        deposit,
        withdraw,
        swap,
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

