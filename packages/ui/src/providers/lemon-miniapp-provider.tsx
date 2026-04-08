import { getNetworkConfig } from '@/shared/config/network'
import {
	authenticate,
	deposit,
	withdraw,
	isLemonWebView,
	TransactionResult,
	TokenName,
	ClaimKey,
	ChainId,
} from '@lemoncash/mini-app-sdk'
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
const LEMON_SDK_TIMEOUT_MS = 25_000

function getLemonChainIdFromConfig(): ChainId {
    return getNetworkConfig().chain.id as ChainId
}

function getTransactionErrorMessage(result: unknown): string {
	if (!result || typeof result !== 'object') return 'Lemon transaction failed'
	const maybeResult = result as { result?: string; error?: { message?: string } }
	if (maybeResult.error?.message) return maybeResult.error.message
	if (maybeResult.result) return `Lemon transaction status: ${maybeResult.result}`
	return 'Lemon transaction failed'
}

function isSuccessOrPending(result: unknown): boolean {
	if (!result || typeof result !== 'object') return false
	const status = (result as { result?: string }).result
	return status === TransactionResult.SUCCESS || status === TransactionResult.PENDING
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout> | undefined
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
	})
	try {
		return await Promise.race([promise, timeoutPromise])
	} finally {
		if (timeoutId) clearTimeout(timeoutId)
	}
}

export function LemonMiniappProvider({ children }: { children: ReactNode }) {
    const [wallet, setWallet] = useState<string | undefined>(undefined)
    const [lemonTag, setLemonTag] = useState<string | undefined>(undefined)
    const [authToken, setAuthToken] = useState<string | undefined>(undefined)
    const [isAuthenticating, setIsAuthenticating] = useState(true)
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
            if (!inLemonWebView) {
                setIsAuthenticating(false)
            }
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
                    // Keep wallet available even when backend verification fails.
                    // Deposit/withdraw and on-chain portfolio reads depend on wallet address,
                    // while JWT is only needed for protected API endpoints.
                    setWalletAndToken(walletAddress, undefined, lemonTagValue)
                    console.warn('Backend signature verification failed:', verification.error)
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

	const ensureLemonAuthentication = useCallback(async (): Promise<void> => {
		if (wallet) return
		const chainId = getLemonChainIdFromConfig()
		const result = await withTimeout(
			authenticate({
				chainId,
				requirements: {
					claims: [ClaimKey.LEMONTAG],
				},
			}),
			LEMON_SDK_TIMEOUT_MS,
			'Authentication timeout. Please confirm in Lemon and try again.'
		)

		if (result.result === TransactionResult.CANCELLED) {
			throw new Error('Authentication cancelled')
		}
		if (result.result === TransactionResult.FAILED) {
			throw new Error(`${result.error?.message || 'Authentication failed'} (chainId=${chainId})`)
		}

		const { wallet: walletAddress, grantedClaims } = result.data
		const lemonTagValue = Array.isArray(grantedClaims)
			? grantedClaims.find((c: { key: string; value: string }) => c.key === ClaimKey.LEMONTAG)?.value
			: undefined
		setWalletAndToken(walletAddress, undefined, lemonTagValue)
	}, [wallet, setWalletAndToken])

    const handleDeposit = useCallback(async (amount: string, tokenName: TokenName) => {
        const inWebView = await isLemonWebView()
        if (!inWebView) {
            throw new Error('Please open this app in Lemon Cash')
        }

        try {
			await ensureLemonAuthentication()
			const chainId = getLemonChainIdFromConfig()
            const result = await withTimeout(
				deposit({
					amount,
					tokenName,
					chainId,
				}),
				LEMON_SDK_TIMEOUT_MS,
				'Deposit timeout. Please confirm in Lemon and try again.'
			)
			if (!isSuccessOrPending(result)) {
				throw new Error(`${getTransactionErrorMessage(result)} (chainId=${chainId})`)
			}
        } catch (error) {
            console.error('Deposit failed:', error)
            throw error
        }
    }, [ensureLemonAuthentication])

    const handleWithdraw = useCallback(async (amount: string, tokenName: TokenName) => {
        const inWebView = await isLemonWebView()
        if (!inWebView) {
            throw new Error('Please open this app in Lemon Cash')
        }

        try {
			await ensureLemonAuthentication()
			const chainId = getLemonChainIdFromConfig()
            const result = await withTimeout(
				withdraw({
					amount,
					tokenName,
					chainId,
				}),
				LEMON_SDK_TIMEOUT_MS,
				'Withdraw timeout. Please confirm in Lemon and try again.'
			)
			if (!isSuccessOrPending(result)) {
				throw new Error(`${getTransactionErrorMessage(result)} (chainId=${chainId})`)
			}
        } catch (error) {
            console.error('Withdraw failed:', error)
            throw error
        }
    }, [ensureLemonAuthentication])

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
