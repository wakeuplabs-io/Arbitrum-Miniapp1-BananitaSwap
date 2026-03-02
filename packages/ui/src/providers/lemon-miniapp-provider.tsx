import { getNetworkConfig } from '@/shared/config/network'
import { authenticate, deposit, withdraw, isLemonWebView, TransactionResult, TokenName } from '@lemoncash/mini-app-sdk'
import { createContext, useContext, type ReactNode, useEffect, useState, useCallback, useRef } from 'react'
import { fetchNonce, verifySignature } from '@/services/auth-api'

export type AuthLogEntry = { id: number; time: string; message: string }

type LemonMiniappContextType = {
    wallet: string | undefined
    authToken: string | undefined
    isAuthenticated: boolean
    isInLemonWebView: boolean
    handleAuthentication: () => Promise<void>
    handleDeposit: (amount: string, tokenName: TokenName) => Promise<void>
    handleWithdraw: (amount: string, tokenName: TokenName) => Promise<void>
    isAuthenticating: boolean
    setWallet: (address: string | undefined) => void
    authLogs: AuthLogEntry[]
    clearAuthLogs: () => void
    getAuthHeaders: () => Record<string, string>
}

const LemonMiniappContext = createContext<LemonMiniappContextType | undefined>(undefined)

function now() {
    return new Date().toISOString()
}

export function LemonMiniappProvider({ children }: { children: ReactNode }) {
    const [wallet, setWallet] = useState<string | undefined>(undefined)
    const [authToken, setAuthToken] = useState<string | undefined>(undefined)
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [isInLemonWebView, setIsInLemonWebView] = useState(false)
    const [authLogs, setAuthLogs] = useState<AuthLogEntry[]>([])
    const logIdRef = useRef(0)

    const addAuthLog = useCallback((message: string) => {
        const id = ++logIdRef.current
        setAuthLogs((prev) => [...prev, { id, time: now(), message }])
    }, [])

    const clearAuthLogs = useCallback(() => {
        setAuthLogs([])
    }, [])

    const setWalletAndToken = useCallback((address: string | undefined, token?: string) => {
        setWallet(address)
        setAuthToken(address ? token ?? undefined : undefined)
    }, [])

    const getAuthHeaders = useCallback((): Record<string, string> => {
        if (!authToken) return {}
        return { Authorization: `Bearer ${authToken}` }
    }, [authToken])

    useEffect(() => {
        addAuthLog('Provider mounted')
        async function checkWebView() {
            addAuthLog('checkWebView: calling isLemonWebView()')
            const inLemonWebView = await isLemonWebView()
            addAuthLog(`checkWebView: isLemonWebView() => ${inLemonWebView}`)
            setIsInLemonWebView(inLemonWebView)
        }
        checkWebView()
    }, [addAuthLog])

    const handleAuthentication = useCallback(async () => {
        addAuthLog('handleAuthentication: called')
        const inLemonWebView = await isLemonWebView()
        addAuthLog(`handleAuthentication: isLemonWebView() => ${inLemonWebView}`)
        if (!inLemonWebView) {
            addAuthLog('handleAuthentication: not in Lemon WebView, skipping')
            return
        }

        setIsAuthenticating(true)
        let nonce: string
        try {
            addAuthLog('handleAuthentication: fetching nonce from backend')
            nonce = await fetchNonce()
            addAuthLog(`handleAuthentication: nonce received (length ${nonce.length})`)
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            addAuthLog(`handleAuthentication: nonce fetch failed => ${msg}`)
            throw new Error(`Nonce fetch failed: ${msg}`)
        }

        addAuthLog('handleAuthentication: calling authenticate({ nonce, chainId })')
        try {
            const result = await authenticate({
                nonce,
                chainId: getNetworkConfig().chain.id,
            })
            addAuthLog(`handleAuthentication: authenticate() result => ${result.result}`)

            if (result.result === TransactionResult.SUCCESS) {
                const { wallet: walletAddress, signature, message } = result.data
                addAuthLog('handleAuthentication: verifying signature on backend')
                const verification = await verifySignature({
                    wallet: walletAddress,
                    signature,
                    message,
                    nonce,
                })
                if (verification.verified) {
                    setWalletAndToken(walletAddress, verification.token)
                    addAuthLog(`handleAuthentication: verified, wallet set => ${walletAddress.slice(0, 10)}...`)
                } else {
                    const verifyUnavailable =
                        verification.error?.includes('404') ||
                        verification.error?.toLowerCase().includes('failed to fetch')
                    if (verifyUnavailable) {
                        setWalletAndToken(walletAddress)
                        addAuthLog('handleAuthentication: verify endpoint unavailable, wallet set (dev fallback)')
                    } else {
                        addAuthLog(`handleAuthentication: verification failed => ${verification.error ?? 'unknown'}`)
                    }
                }
            } else if (result.result === TransactionResult.FAILED) {
                addAuthLog(`handleAuthentication: FAILED => ${result.error.message} (${result.error.code})`)
            } else {
                addAuthLog('handleAuthentication: CANCELLED by user')
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            addAuthLog(`handleAuthentication: authenticate() threw => ${msg}`)
            console.error('Authentication failed:', error)
        } finally {
            setIsAuthenticating(false)
            addAuthLog('handleAuthentication: done (isAuthenticating=false)')
        }
    }, [addAuthLog, setWalletAndToken])

    useEffect(() => {
        if (isInLemonWebView) {
            handleAuthentication()
        }
    }, [isInLemonWebView, handleAuthentication, addAuthLog])

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
        authToken,
        isAuthenticated: !!wallet,
        isInLemonWebView,
        handleAuthentication,
        handleDeposit,
        handleWithdraw,
        isAuthenticating,
        setWallet: (address) => setWalletAndToken(address),
        authLogs,
        clearAuthLogs,
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
