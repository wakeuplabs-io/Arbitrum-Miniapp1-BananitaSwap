import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getPublicClientForChain } from '@/shared/config/viem'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
import { formatUnits, parseAbi, parseAbiItem, type Address } from 'viem'
import {
    ARBITRUM_MAINNET_USDC_ADDRESS,
    ARBITRUM_SEPOLIA_USDC_ADDRESS,
} from '@/shared/config/network'
import type { PortfolioChain } from '@/shared/config/network'
import { getTokenPairsForAddresses, getTokensInfo } from '@/services/dexscreener'
import { apiTokenItemToToken, getUsdcTokenForChain, pairToTokenFromTokenPairs } from '@/hooks/use-tokens'
import { fetchTokens } from '@/services/tokens-api'
import type { Token } from '@/lib/tokens'

const SEPOLIA_USDC_LOWER = ARBITRUM_SEPOLIA_USDC_ADDRESS.toLowerCase()
const MAINNET_USDC_LOWER = ARBITRUM_MAINNET_USDC_ADDRESS.toLowerCase()

// ERC20 ABI for balanceOf and decimals - using parseAbi for proper typing
const ERC20_ABI = parseAbi([
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
])



type OwnedTokensResult = {
    balances: Map<string, number>
    tokens: Token[]
}

/**
 * Hook to get tokens owned by an address by analyzing Transfer events
 * and checking current balances. Uses tokens list from API as primary source;
 * DexScreener fallback only for tokens not in the API list.
 * @param chain - Which chain to fetch from (portfolio only). Omit or use default for mainnet when outside portfolio.
 */
export function useOwnedTokens(chain: PortfolioChain = 'mainnet') {
    const { wallet } = useLemonMiniapp()
    const client = getPublicClientForChain(chain)

    return useQuery({
        queryKey: ['owned-tokens', wallet, chain],
        queryFn: async (): Promise<OwnedTokensResult> => {
            if (!wallet) {
                return { balances: new Map(), tokens: [] }
            }

            const walletAddress = wallet.toLowerCase() as Address
            const balanceMap = new Map<string, number>()

            try {
                const transferEvent = parseAbiItem(
                    'event Transfer(address indexed from, address indexed to, uint256 value)'
                )

                const logs = await client.getLogs({
                    event: transferEvent,
                    args: {
                        to: walletAddress, // ← Filters at RPC level using indexed parameter!
                    },
                    fromBlock: 0n,
                    toBlock: 'latest',
                })

                const latestByToken = new Map<string, (typeof logs)[number]>()

                for (const log of logs) {
                    if (!log.address) continue

                    const tokenAddress = log.address.toLowerCase()
                    const prev = latestByToken.get(tokenAddress)

                    // Keep the latest transfer per token (highest block number)
                    if (!prev || (log.blockNumber ?? 0n) > (prev.blockNumber ?? 0n)) {
                        latestByToken.set(tokenAddress, log)
                    }
                }

                const tokenAddresses = Array.from(latestByToken.keys())
                const batchSize = 50
                const balanceMapTemp = new Map<string, number>()

                // Batch balance + decimals via multicall (2 RPC calls per batch instead of 1–2 per token)
                for (let i = 0; i < tokenAddresses.length; i += batchSize) {
                    const batch = tokenAddresses.slice(i, i + batchSize)

                    const balanceContracts = batch.map((tokenAddress) => ({
                        address: tokenAddress as Address,
                        abi: ERC20_ABI,
                        functionName: 'balanceOf' as const,
                        args: [walletAddress],
                    }))

                    const balanceResults = await client.multicall({
                        contracts: balanceContracts,
                        allowFailure: true,
                    })

                    const tokensWithBalance: { address: string; balance: bigint }[] = []
                    balanceResults.forEach((res, idx) => {
                        if (res.status !== 'success' || res.result === 0n) return
                        const tokenAddress = batch[idx]
                        if (res.result! > 0n) {
                            tokensWithBalance.push({ address: tokenAddress, balance: res.result! })
                        }
                    })

                    if (tokensWithBalance.length === 0) continue

                    const decimalsContracts = tokensWithBalance.map(({ address }) => ({
                        address: address as Address,
                        abi: ERC20_ABI,
                        functionName: 'decimals' as const,
                    }))

                    const decimalsResults = await client.multicall({
                        contracts: decimalsContracts,
                        allowFailure: true,
                    })

                    decimalsResults.forEach((res, idx) => {
                        const { address, balance } = tokensWithBalance[idx]
                        const decimals = res.status === 'success' ? Number(res.result) : 18
                        const formattedBalance = parseFloat(formatUnits(balance, decimals))
                        if (formattedBalance > 0) {
                            balanceMapTemp.set(address, formattedBalance)
                        }
                    })
                }

                // Copy results to final map
                for (const [address, balance] of balanceMapTemp) {
                    balanceMap.set(address, balance)
                }

                // Use tokens list from API as primary source; DexScreener fallback for tokens not in list
                const ownedTokenAddresses = Array.from(balanceMap.keys())
                const tokensByAddress = new Map<string, Token>()

                const { tokens: apiTokens } = await fetchTokens()
                const apiTokenByAddress = new Map(
                    apiTokens.map((t) => [t.otherToken.address.toLowerCase(), t])
                )

                for (const address of ownedTokenAddresses) {
                    const lookupAddress = address === SEPOLIA_USDC_LOWER ? MAINNET_USDC_LOWER : address
                    const apiToken = apiTokenByAddress.get(lookupAddress)
                    if (apiToken) {
                        tokensByAddress.set(address, apiTokenItemToToken(apiToken))
                    }
                }

                // Fallback to DexScreener for tokens not in our API list
                const addressesNotInApi = ownedTokenAddresses.filter(
                    (addr) =>
                        addr !== SEPOLIA_USDC_LOWER &&
                        addr !== MAINNET_USDC_LOWER &&
                        !apiTokenByAddress.has(addr)
                )
                const uniqueNotInApi = [...new Set(addressesNotInApi)]
                if (uniqueNotInApi.length > 0) {
                    const pairs = await getTokenPairsForAddresses(uniqueNotInApi)
                    const bestPairByAddr = new Map<string, { pair: (typeof pairs)[0]; liquidity: number }>()
                    for (const pair of pairs) {
                        const addr = pair.quoteToken?.address?.toLowerCase()
                        if (!addr || !balanceMap.has(addr)) continue
                        const liquidity =
                            typeof pair.liquidity?.usd === 'string'
                                ? parseFloat(pair.liquidity.usd)
                                : pair.liquidity?.usd || 0
                        const existing = bestPairByAddr.get(addr)
                        if (!existing || liquidity > existing.liquidity) {
                            bestPairByAddr.set(addr, { pair, liquidity })
                        }
                    }
                    for (const { pair } of bestPairByAddr.values()) {
                        const token = pairToTokenFromTokenPairs(pair)
                        const addr = token.address?.toLowerCase()
                        if (addr) tokensByAddress.set(addr, token)
                    }
                }

                // Inject USDC when user has balance
                if (balanceMap.has(SEPOLIA_USDC_LOWER)) {
                    tokensByAddress.set(SEPOLIA_USDC_LOWER, getUsdcTokenForChain('sepolia'))
                }
                if (balanceMap.has(MAINNET_USDC_LOWER)) {
                    tokensByAddress.set(MAINNET_USDC_LOWER, getUsdcTokenForChain('mainnet'))
                }

                // Enrich with 24h price change from DexScreener (mainnet only)
                const addressesForChange24h = Array.from(tokensByAddress.keys()).map((a) =>
                    a === SEPOLIA_USDC_LOWER ? MAINNET_USDC_LOWER : a
                )
                const uniqueForChange24h = [...new Set(addressesForChange24h)]
                if (uniqueForChange24h.length > 0) {
                    try {
                        const infos = await getTokensInfo(uniqueForChange24h)
                        for (const info of infos) {
                            const addr = info.address.toLowerCase()
                            const token = tokensByAddress.get(addr)
                            if (token) token.change24h = info.priceChange24h
                            if (addr === MAINNET_USDC_LOWER) {
                                const sepToken = tokensByAddress.get(SEPOLIA_USDC_LOWER)
                                if (sepToken) sepToken.change24h = info.priceChange24h
                            }
                        }
                    } catch (error) {
                        console.warn('Failed to fetch 24h change for portfolio:', error)
                    }
                }

                return {
                    balances: balanceMap,
                    tokens: Array.from(tokensByAddress.values()),
                }
            } catch (error) {
                console.error('Failed to fetch owned tokens:', error)
                return { balances: balanceMap, tokens: [] }
            }
        },
        enabled: !!wallet,
        staleTime: 30 * 1000, // 30 seconds
    })
}


/**
 * Hook to get owned token addresses
 * Returns a Set of token addresses that the user owns (has balance > 0)
 */
export function useOwnedTokenAddresses() {
    const { data: ownedTokensData } = useOwnedTokens()

    const ownedAddresses = useMemo(() => {
        if (!ownedTokensData || !ownedTokensData.balances || ownedTokensData.balances.size === 0) {
            return new Set<string>()
        }

        return new Set(ownedTokensData.balances.keys())
    }, [ownedTokensData])

    return ownedAddresses
}

/**
 * Hook to get owned tokens with full metadata
 * Returns an array of Token objects for tokens the user owns
 */
export function useOwnedTokenList() {
    const { data: ownedTokensData } = useOwnedTokens()

    const ownedTokens = useMemo(() => {
        if (!ownedTokensData || !ownedTokensData.tokens || ownedTokensData.tokens.length === 0) {
            return []
        }

        return ownedTokensData.tokens
    }, [ownedTokensData])

    return ownedTokens
}
