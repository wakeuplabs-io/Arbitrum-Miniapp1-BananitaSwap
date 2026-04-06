import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTokensInfo, type DexScreenerPair } from '@/services/dexscreener'
import { fetchTokens, TOKENS_API_USE_ALLOWLIST, type ApiTokenItem } from '@/services/tokens-api'
import {
    ARBITRUM_MAINNET_USDC_ADDRESS,
    ARBITRUM_SEPOLIA_USDC_ADDRESS,
} from '@/shared/config/network'
import type { PortfolioChain } from '@/shared/config/network'
import type { Token } from '@/lib/tokens'

const USDC_BASE: Omit<Token, 'address' | 'chainId'> = {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: 'usdc',
    logoUrl: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
    color: '#2775CA',
    price: 1.0,
    change24h: 0,
    marketCap: '$32B',
}

/**
 * Get USDC token for a specific chain (e.g. portfolio view).
 */
export function getUsdcTokenForChain(chain: PortfolioChain): Token {
    const address = chain === 'mainnet' ? ARBITRUM_MAINNET_USDC_ADDRESS : ARBITRUM_SEPOLIA_USDC_ADDRESS
    const chainId = chain === 'mainnet' ? 'arbitrum' : 'arbitrum-sepolia'
    return { ...USDC_BASE, address, chainId }
}

/**
 * Get the USDC token for swap screen. Always mainnet (DexScreener is mainnet-only).
 */
export function getUsdcToken(): Token {
    return getUsdcTokenForChain('mainnet')
}


/** Generate a color based on symbol hash for consistency */
function hashColor(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = hash % 360
    return `hsl(${hue}, 70%, 50%)`
}

/** Format totalValueLockedUSD for market cap display */
function formatMarketCap(tvl: number): string {
    if (!Number.isFinite(tvl) || tvl <= 0 || tvl > 1e15) return '-'
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`
    if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(1)}K`
    return `$${Math.round(tvl)}`
}

/** Convert API token item to Token format (price/liquidity from subgraph via API). change24h optional; undefined = not found. */
export function apiTokenItemToToken(item: ApiTokenItem, change24h?: number): Token {
    const { otherToken, poolAddress, priceUsd, totalValueLockedUSD, dexId, providerId, venues } = item
    const safePrice = Number.isFinite(priceUsd) && priceUsd >= 0 && priceUsd <= 1e9 ? priceUsd : 0
    return {
        symbol: otherToken.symbol,
        name: otherToken.name,
        icon: otherToken.symbol.toLowerCase(),
        color: hashColor(otherToken.symbol),
        price: safePrice,
        change24h,
        marketCap: formatMarketCap(totalValueLockedUSD),
        address: otherToken.address,
        chainId: 'arbitrum',
        dexId,
        providerId,
        swapVenues: venues ?? [],
        pairAddress: poolAddress ?? undefined,
    }
}

/**
 * Convert DexScreener pair to Token format (for token-pairs endpoint; quoteToken = other token).
 * Used by use-owned-tokens for portfolio holdings from getTokenPairsForAddresses.
 */
export function pairToTokenFromTokenPairs(pair: DexScreenerPair): Token {
    const token = pair.quoteToken
    const change24hValue = pair.priceChange?.h24
    const change24h =
        typeof change24hValue === 'string' ? parseFloat(change24hValue) : change24hValue || 0
    const liquidityValue = pair.liquidity?.usd
    const liquidity =
        typeof liquidityValue === 'string' ? parseFloat(liquidityValue) : liquidityValue || 0
    const fdvValue = pair.fdv
    const fdv = typeof fdvValue === 'string' ? parseFloat(fdvValue) : fdvValue || 0
    const marketCapValue = fdv > 0 ? fdv : liquidity
    const marketCap =
        marketCapValue >= 1e9
            ? `$${(marketCapValue / 1e9).toFixed(1)}B`
            : marketCapValue >= 1e6
              ? `$${(marketCapValue / 1e6).toFixed(1)}M`
              : marketCapValue >= 1e3
                ? `$${(marketCapValue / 1e3).toFixed(1)}K`
                : `$${marketCapValue.toFixed(0)}`
    return {
        symbol: token.symbol,
        name: token.name,
        icon: token.symbol.toLowerCase(),
        color: hashColor(token.symbol),
        price: 0,
        change24h,
        marketCap,
        address: token.address,
        chainId: pair.chainId,
        pairAddress: pair.pairAddress,
    }
}

/** Shared query key for tokens API – used by useAllTokens and useOwnedTokens. */
export const TOKENS_QUERY_KEY = ['tokens', { allowlist: TOKENS_API_USE_ALLOWLIST }] as const

/**
 * Hook to fetch USDC-paired tokens from backend (/tokens API).
 * Shows tokens immediately from API; fetches 24h change from DexScreener in background (non-blocking).
 */
export function useAllTokens() {
    const tokensQuery = useQuery({
        queryKey: TOKENS_QUERY_KEY,
        queryFn: async () => {
            const res = await fetchTokens()
            return { tokens: res.tokens, tokenAddresses: res.tokenAddresses }
        },
        staleTime: 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
    })

    const change24hQuery = useQuery({
        queryKey: ['tokens-change24h', tokensQuery.data?.tokenAddresses ?? []],
        queryFn: () => getTokensInfo(tokensQuery.data!.tokenAddresses),
        enabled: !!(tokensQuery.data?.tokenAddresses?.length),
        staleTime: 60 * 1000,
    })

    const mergedData = useMemo(() => {
        const { tokens } = tokensQuery.data ?? { tokens: [], tokenAddresses: [] }
        if (tokens.length === 0) return undefined
        const change24hMap = new Map<string, number>()
        if (change24hQuery.data) {
            for (const info of change24hQuery.data) {
                change24hMap.set(info.address.toLowerCase(), info.priceChange24h)
            }
        }
        const result = tokens.map((item) => {
            const change24h = change24hMap.get(item.otherToken.address.toLowerCase())
            return apiTokenItemToToken(item, change24h)
        })
        const usdc = getUsdcToken()
        const tokensWithoutUsdc = result.filter((t) => t.symbol !== 'USDC')
        return [usdc, ...tokensWithoutUsdc] as Token[]
    }, [tokensQuery.data, change24hQuery.data])

    return {
        ...tokensQuery,
        data: mergedData,
        isFetching: tokensQuery.isFetching || change24hQuery.isFetching,
    }
}

