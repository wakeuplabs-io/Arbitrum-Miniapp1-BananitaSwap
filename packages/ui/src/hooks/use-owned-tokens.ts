import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getPublicClientForChain } from '@/shared/config/viem'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
import { formatUnits, parseAbi, parseAbiItem, type Address } from 'viem'
import {
    ARBITRUM_MAINNET_USDC_ADDRESS,
    ARBITRUM_MAINNET_USDC_E_ADDRESS,
    ARBITRUM_SEPOLIA_USDC_ADDRESS,
} from '@/shared/config/network'
import type { PortfolioChain } from '@/shared/config/network'
import { getTokenPairsForAddresses, getTokensInfo } from '@/services/dexscreener'
import {
    apiTokenItemToToken,
    getUsdcTokenForChain,
    pairToTokenFromTokenPairs,
    TOKENS_QUERY_KEY,
} from '@/hooks/use-tokens'
import { fetchTokens } from '@/services/tokens-api'
import type { Token } from '@/lib/tokens'
import type { ApiTokenItem } from '@/services/tokens-api'

const SEPOLIA_USDC_LOWER = ARBITRUM_SEPOLIA_USDC_ADDRESS.toLowerCase()
const MAINNET_USDC_LOWER = ARBITRUM_MAINNET_USDC_ADDRESS.toLowerCase()
const MAINNET_USDC_E_LOWER = ARBITRUM_MAINNET_USDC_E_ADDRESS.toLowerCase()
/** Native USDC on Arbitrum mainnet (0xaf88d065e77c8cc2239327c5edb3a432268e5831) */
const MAINNET_USDC_NATIVE_LOWER = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'

/** Max tokens to check via multicall on mainnet (API-first path). Covers top TVL tokens. */
const MAINNET_BALANCE_CHECK_LIMIT = 400

/** Arbitrum RPC limit: eth_getLogs block range per request (typically 10_000). */
const GET_LOGS_BLOCK_RANGE = 10_000n

// ERC20 ABI for balanceOf and decimals - using parseAbi for proper typing
const ERC20_ABI = parseAbi([
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
])



type OwnedTokensResult = {
    balances: Map<string, number>
    tokens: Token[]
}

type PublicClient = ReturnType<typeof getPublicClientForChain>

/** Mainnet: fetch balances by multicalling API token list (fast, no getLogs). */
async function fetchBalancesFromApiTokens(
    client: PublicClient,
    walletAddress: Address,
    balanceMap: Map<string, number>,
    apiTokens: ApiTokenItem[]
) {
    const addressesToCheck = [
        MAINNET_USDC_LOWER,
        MAINNET_USDC_NATIVE_LOWER,
        MAINNET_USDC_E_LOWER,
        ...apiTokens.slice(0, MAINNET_BALANCE_CHECK_LIMIT).map((t) => t.otherToken.address.toLowerCase()),
    ]
    const uniqueAddresses = [...new Set(addressesToCheck)]

    const batchSize = 50
    for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
        const batch = uniqueAddresses.slice(i, i + batchSize)
        const balanceContracts = batch.map((tokenAddress) => ({
            address: tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: 'balanceOf' as const,
            args: [walletAddress],
        }))

        const balanceResults = await client.multicall({ contracts: balanceContracts, allowFailure: true })
        const tokensWithBalance: { address: string; balance: bigint }[] = []

        balanceResults.forEach((res, idx) => {
            if (res.status !== 'success' || res.result === 0n) return
            const tokenAddress = batch[idx]
            if (res.result! > 0n) tokensWithBalance.push({ address: tokenAddress, balance: res.result! })
        })

        if (tokensWithBalance.length === 0) continue

        const decimalsResults = await client.multicall({
            contracts: tokensWithBalance.map(({ address }) => ({
                address: address as Address,
                abi: ERC20_ABI,
                functionName: 'decimals' as const,
            })),
            allowFailure: true,
        })

        decimalsResults.forEach((res, idx) => {
            const { address, balance } = tokensWithBalance[idx]
            const decimals = res.status === 'success' ? Number(res.result) : 18
            const formatted = parseFloat(formatUnits(balance, decimals))
            if (formatted > 0) balanceMap.set(address, formatted)
        })
    }
}

/** Sepolia: discover tokens via Transfer logs in limited block range (respects RPC 10k block limit). Always checks USDC explicitly since deposits may predate the log window. */
async function fetchBalancesFromTransferLogs(
    client: PublicClient,
    walletAddress: Address,
    balanceMap: Map<string, number>
) {
    const blockNumber = await client.getBlockNumber()
    const fromBlock = blockNumber > GET_LOGS_BLOCK_RANGE ? blockNumber - GET_LOGS_BLOCK_RANGE : 0n

    const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
    const logs = await client.getLogs({
        event: transferEvent,
        args: { to: walletAddress },
        fromBlock,
        toBlock: blockNumber,
    })

    const latestByToken = new Map<string, (typeof logs)[number]>()
    for (const log of logs) {
        if (!log.address) continue
        const tokenAddress = log.address.toLowerCase()
        const prev = latestByToken.get(tokenAddress)
        if (!prev || (log.blockNumber ?? 0n) > (prev.blockNumber ?? 0n)) {
            latestByToken.set(tokenAddress, log)
        }
    }

    const discoveredAddresses = Array.from(latestByToken.keys())
    const tokenAddresses = [SEPOLIA_USDC_LOWER, ...discoveredAddresses.filter((a) => a !== SEPOLIA_USDC_LOWER)]
    const batchSize = 50

    for (let i = 0; i < tokenAddresses.length; i += batchSize) {
        const batch = tokenAddresses.slice(i, i + batchSize)
        const balanceResults = await client.multicall({
            contracts: batch.map((addr) => ({
                address: addr as Address,
                abi: ERC20_ABI,
                functionName: 'balanceOf' as const,
                args: [walletAddress],
            })),
            allowFailure: true,
        })

        const tokensWithBalance: { address: string; balance: bigint }[] = []
        balanceResults.forEach((res, idx) => {
            if (res.status !== 'success' || res.result === 0n) return
            const tokenAddress = batch[idx]
            if (res.result! > 0n) tokensWithBalance.push({ address: tokenAddress, balance: res.result! })
        })

        if (tokensWithBalance.length === 0) continue

        const decimalsResults = await client.multicall({
            contracts: tokensWithBalance.map(({ address }) => ({
                address: address as Address,
                abi: ERC20_ABI,
                functionName: 'decimals' as const,
            })),
            allowFailure: true,
        })

        decimalsResults.forEach((res, idx) => {
            const { address, balance } = tokensWithBalance[idx]
            const decimals = res.status === 'success' ? Number(res.result) : 18
            const formatted = parseFloat(formatUnits(balance, decimals))
            if (formatted > 0) balanceMap.set(address, formatted)
        })
    }
}

/** Build token metadata from balances; API first, DexScreener fallback for unknown tokens. */
async function buildTokensByAddress(
    ownedTokenAddresses: string[],
    balanceMap: Map<string, number>,
    apiTokens: ApiTokenItem[]
): Promise<Map<string, Token>> {
    const tokensByAddress = new Map<string, Token>()
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

    const addressesNotInApi = ownedTokenAddresses.filter(
        (addr) =>
            addr !== SEPOLIA_USDC_LOWER &&
            addr !== MAINNET_USDC_LOWER &&
            addr !== MAINNET_USDC_NATIVE_LOWER &&
            addr !== MAINNET_USDC_E_LOWER &&
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
            if (!existing || liquidity > existing.liquidity) bestPairByAddr.set(addr, { pair, liquidity })
        }
        for (const { pair } of bestPairByAddr.values()) {
            const token = pairToTokenFromTokenPairs(pair)
            const addr = token.address?.toLowerCase()
            if (addr) tokensByAddress.set(addr, token)
        }
    }

    const usdcMainnet = getUsdcTokenForChain('mainnet')
    if (balanceMap.has(SEPOLIA_USDC_LOWER)) {
        tokensByAddress.set(SEPOLIA_USDC_LOWER, getUsdcTokenForChain('sepolia'))
    }
    if (balanceMap.has(MAINNET_USDC_LOWER)) {
        tokensByAddress.set(MAINNET_USDC_LOWER, usdcMainnet)
    }
    if (balanceMap.has(MAINNET_USDC_NATIVE_LOWER)) {
        tokensByAddress.set(MAINNET_USDC_NATIVE_LOWER, { ...usdcMainnet, address: MAINNET_USDC_NATIVE_LOWER })
    }
    if (balanceMap.has(MAINNET_USDC_E_LOWER)) {
        tokensByAddress.set(MAINNET_USDC_E_LOWER, {
            ...usdcMainnet,
            address: ARBITRUM_MAINNET_USDC_E_ADDRESS,
            symbol: 'USDC.e',
            name: 'USD Coin (bridged)',
        })
    }

    return tokensByAddress
}

/**
 * Hook to get tokens owned by an address by analyzing Transfer events
 * and checking current balances. Uses tokens list from API as primary source;
 * DexScreener fallback only for tokens not in the API list.
 * @param chain - Which chain to fetch from (portfolio only). Omit or use default for mainnet when outside portfolio.
 */
export function useOwnedTokens(chain: PortfolioChain = 'mainnet') {
    const { wallet } = useLemonMiniapp()
    const queryClient = useQueryClient()
    const client = getPublicClientForChain(chain)

    return useQuery({
        queryKey: ['owned-tokens', wallet, chain],
        queryFn: async (): Promise<OwnedTokensResult> => {
            if (!wallet) {
                return { balances: new Map(), tokens: [] }
            }

            const walletAddress = wallet.toLowerCase() as Address
            const balanceMap = new Map<string, number>()

            const tokensData = await queryClient.ensureQueryData({
                queryKey: TOKENS_QUERY_KEY,
                queryFn: async () => {
                    const res = await fetchTokens()
                    return { tokens: res.tokens, tokenAddresses: res.tokenAddresses }
                },
            })
            const apiTokens = tokensData.tokens

            try {
                if (chain === 'mainnet') {
                    await fetchBalancesFromApiTokens(client, walletAddress, balanceMap, apiTokens)
                } else {
                    await fetchBalancesFromTransferLogs(client, walletAddress, balanceMap)
                }

                if (balanceMap.size === 0) {
                    return { balances: new Map(), tokens: [] }
                }

                const ownedTokenAddresses = Array.from(balanceMap.keys())
                const tokensByAddress = await buildTokensByAddress(
                    ownedTokenAddresses,
                    balanceMap,
                    apiTokens
                )

                // Enrich with 24h price change from DexScreener (mainnet only)
                const addressesForChange24h = ownedTokenAddresses.map((a) =>
                    a === SEPOLIA_USDC_LOWER || a === MAINNET_USDC_E_LOWER ? MAINNET_USDC_LOWER : a
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
                                const usdceToken = tokensByAddress.get(MAINNET_USDC_E_LOWER)
                                if (usdceToken) usdceToken.change24h = info.priceChange24h
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
