import { getNetworkConfig } from '@/shared/config/network'
import { authenticate, deposit, withdraw, isLemonWebView, TransactionResult, TokenName, ClaimKey } from '@lemoncash/mini-app-sdk'
import { createContext, useContext, type ReactNode, useEffect, useState, useCallback } from 'react'
import { fetchNonce, verifySignature } from '@/services/auth-api'

type LemonMiniappContextType = {
    wallet: string | undefined
    lemonTag: string | undefined
    authToken: string | undefined
    isAuthenticated: boolean
    isInLemonWebView: boolean
    handleAuthentication: () => Promise<void>
    handleDeposit: (amount: string, tokenName: TokenName) => Promise<void>
    handleWithdraw: (amount: string, tokenName: TokenName) => Promise<void>
    isAuthenticating: boolean
    setWallet: (address: string | undefined) => void
    getAuthHeaders: () => Record<string, string>
}

const LemonMiniappContext = createContext<LemonMiniappContextType | undefined>(undefined)

export function LemonMiniappProvider({ children }: { children: ReactNode }) {
    const [wallet, setWallet] = useState<string | undefined>(undefined)
    const [lemonTag, setLemonTag] = useState<string | undefined>(undefined)
    const [authToken, setAuthToken] = useState<string | undefined>(undefined)
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [isInLemonWebView, setIsInLemonWebView] = useState(false)

    const setWalletAndToken = useCallback(
        (address: string | undefined, token?: string, lemonTagValue?: string) => {
            setWallet(address)
            setAuthToken(address ? token ?? undefined : undefined)
            setLemonTag(lemonTagValue ?? undefined)
        },
        []
    )

    const getAuthHeaders = useCallback((): Record<string, string> => {
        if (!authToken) return {}
        return { Authorization: `Bearer ${authToken}` }
    }, [authToken])

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
        let nonce: string
        try {
            nonce = await fetchNonce()
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            throw new Error(`Nonce fetch failed: ${msg}`)
        }

        try {
            const result = await authenticate({
                nonce,
                chainId: getNetworkConfig().chain.id,
                requirements: {
                    claims: [ClaimKey.LEMONTAG]
                }
            })

            if (result.result === TransactionResult.SUCCESS) {
                const { wallet: walletAddress, signature, message, grantedClaims } = result.data
                const lemonTagValue = Array.isArray(grantedClaims)
                    ? grantedClaims.find((c: { key: string; value: string }) => c.key === ClaimKey.LEMONTAG)
                        ?.value
                    : undefined
                const verification = await verifySignature({
                    wallet: walletAddress,
                    signature,
                    message,
                    nonce,
                })
                if (verification.verified) {
                    setWalletAndToken(walletAddress, verification.token, lemonTagValue)
                } else {
                    const verifyUnavailable =
                        verification.error?.includes('404') ||
                        verification.error?.toLowerCase().includes('failed to fetch')
                    if (verifyUnavailable) {
                        setWalletAndToken(walletAddress, undefined, lemonTagValue)
                    }
                }
            }
        } catch (error) {
            console.error('Authentication failed:', error)
        } finally {
            setIsAuthenticating(false)
        }
    }, [setWalletAndToken])

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
        lemonTag,
        authToken,
        isAuthenticated: !!wallet,
        isInLemonWebView,
        handleAuthentication,
        handleDeposit,
        handleWithdraw,
        isAuthenticating,
        setWallet: (address) => setWalletAndToken(address, undefined, undefined),
        getAuthHeaders,
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
