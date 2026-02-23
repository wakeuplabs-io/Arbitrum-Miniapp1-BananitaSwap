import { getNetworkConfig } from '@/shared/config/network'
import { authenticate, deposit, withdraw, isLemonWebView, TransactionResult, TokenName } from '@lemoncash/mini-app-sdk'
import { createContext, useContext, type ReactNode, useEffect, useState, useCallback } from 'react'

type LemonMiniappContextType = {
    wallet: string | undefined
    isAuthenticated: boolean
    isInLemonWebView: boolean
    handleAuthentication: () => Promise<void>
    handleDeposit: (amount: string, tokenName: TokenName) => Promise<void>
    handleWithdraw: (amount: string, tokenName: TokenName) => Promise<void>
    isAuthenticating: boolean
}

const LemonMiniappContext = createContext<LemonMiniappContextType | undefined>(undefined)

export function LemonMiniappProvider({ children }: { children: ReactNode }) {
    const [wallet, setWallet] = useState<string | undefined>(undefined)
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [isInLemonWebView, setIsInLemonWebView] = useState(false)

    useEffect(() => {
        async function checkWebView() {
            const inLemonWebView = await isLemonWebView()
            setIsInLemonWebView(inLemonWebView)
        }
        checkWebView()
    }, [])

    const handleAuthentication = useCallback(async () => {
        const inLemonWebView = await isLemonWebView()
        if (!inLemonWebView) {
            return
        }

        setIsAuthenticating(true)
        try {
            const result = await authenticate({
                chainId: getNetworkConfig().chain.id,
            })
            if (result.result === TransactionResult.SUCCESS) {
                setWallet(result.data.wallet)
            }
        } catch (error) {
            console.error('Authentication failed:', error)
        } finally {
            setIsAuthenticating(false)
        }
    }, [])

    useEffect(() => {
        if (isInLemonWebView) {
            handleAuthentication()
        }
    }, [isInLemonWebView, handleAuthentication])

    const handleDeposit = useCallback(async (amount: string, tokenName: TokenName) => {
        const inWebView = await isLemonWebView()
        if (!inWebView) {
            throw new Error('Please open this app in Lemon Cash')
        }

        try {
            const result = await deposit({
                amount,
                tokenName,
                chainId: getNetworkConfig().chain.id,
            })
            console.log('Deposit successful:', result)
        } catch (error) {
            console.error('Deposit failed:', error)
            throw error
        }
    }, [])

    const handleWithdraw = useCallback(async (amount: string, tokenName: TokenName) => {
        const inWebView = await isLemonWebView()
        if (!inWebView) {
            throw new Error('Please open this app in Lemon Cash')
        }

        try {
            const result = await withdraw({
                amount,
                tokenName,
                chainId: getNetworkConfig().chain.id,
            })
            console.log('Withdraw successful:', result)
        } catch (error) {
            console.error('Withdraw failed:', error)
            throw error
        }
    }, [])

    const value: LemonMiniappContextType = {
        wallet,
        isAuthenticated: !!wallet,
        isInLemonWebView,
        handleAuthentication,
        handleDeposit,
        handleWithdraw,
        isAuthenticating,
    }

    return <LemonMiniappContext.Provider value={value}>{children}</LemonMiniappContext.Provider>
}

export function useLemonMiniapp() {
    const context = useContext(LemonMiniappContext)
    if (context === undefined) {
        throw new Error('useLemonMiniapp must be used within a LemonMiniappProvider')
    }
    return context
}
