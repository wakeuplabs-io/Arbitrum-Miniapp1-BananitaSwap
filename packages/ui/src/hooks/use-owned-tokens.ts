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
import { getUsdcTokenForChain, pairToTokenFromTokenPairs } from '@/hooks/use-tokens'
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
 * and checking current balances. Also fetches token details from DexScreener.
 * @param chain - Which chain to fetch from (portfolio only). Omit or use default for mainnet when outside portfolio.
 * Uses optimized strategies:
 * - Indexed event parameters for RPC-level filtering
 * - Single RPC call to fetch all transfers
 * - In-memory deduplication to track latest transfer per token
 * - Multicall for balance + decimals (2 RPC calls per batch instead of 1–2 per token)
 * - Fetches token metadata from DexScreener API (mainnet only)
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

                // Fetch token details from DexScreener for tokens with balance > 0
                const ownedTokenAddresses = Array.from(balanceMap.keys())
                // DexScreener is mainnet-only: map Sepolia USDC to mainnet USDC so pairs are found
                const addressesForDexScreener = ownedTokenAddresses.map((addr) =>
                    addr === SEPOLIA_USDC_LOWER ? MAINNET_USDC_LOWER : addr
                )
                const uniqueAddressesForDexScreener = [...new Set(addressesForDexScreener)]
                const pairs = await getTokenPairsForAddresses(uniqueAddressesForDexScreener)

                // Convert pairs to tokens, deduplicate by address
                const tokensByAddress = new Map<string, Token>()
                for (const pair of pairs) {
                    const token = pairToTokenFromTokenPairs(pair)
                    const address = token.address?.toLowerCase()
                    if (!address) continue
                    const hasBalance = balanceMap.has(address)
                    const isMainnetUsdc = address === MAINNET_USDC_LOWER
                    const hasSepoliaUsdcBalance = balanceMap.has(SEPOLIA_USDC_LOWER)
                    if (hasBalance || (isMainnetUsdc && hasSepoliaUsdcBalance)) {
                        const existing = tokensByAddress.get(address)
                        const liquidityValue = pair.liquidity?.usd
                        const liquidity = typeof liquidityValue === 'string'
                            ? parseFloat(liquidityValue)
                            : liquidityValue || 0
                        const existingLiquidity = existing?.price || 0

                        if (!existing || liquidity > existingLiquidity) {
                            tokensByAddress.set(address, token)
                        }
                    }
                }

                // DexScreener pairs only give us the "other" token (quoteToken), never USDC. So inject USDC token
                // when user has USDC balance so it appears in the list (for both Sepolia and mainnet).
                if (balanceMap.has(SEPOLIA_USDC_LOWER)) {
                    tokensByAddress.set(SEPOLIA_USDC_LOWER, getUsdcTokenForChain('sepolia'))
                }
                if (balanceMap.has(MAINNET_USDC_LOWER)) {
                    tokensByAddress.set(MAINNET_USDC_LOWER, getUsdcTokenForChain('mainnet'))
                }

                // Also fetch price info using getTokensInfo for better price data (mainnet addresses only for DexScreener)
                if (uniqueAddressesForDexScreener.length > 0) {
                    try {
                        const tokenInfos = await getTokensInfo(uniqueAddressesForDexScreener)
                        const tokenInfosMap = new Map(
                            tokenInfos.map((info) => [info.address.toLowerCase(), info])
                        )

                        // Update tokens with price info
                        for (const [address, token] of tokensByAddress) {
                            const lookupAddress = address === SEPOLIA_USDC_LOWER ? MAINNET_USDC_LOWER : address
                            const tokenInfo = tokenInfosMap.get(lookupAddress)
                            if (tokenInfo) {
                                token.price = tokenInfo.priceUsd
                                token.change24h = tokenInfo.priceChange24h
                            }
                        }
                    } catch (error) {
                        console.error('Failed to fetch token price info:', error)
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
 * Hook to get owned tokens with full metadata from DexScreener
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
