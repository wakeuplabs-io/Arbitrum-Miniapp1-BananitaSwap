import Coingecko from '@coingecko/coingecko-typescript'
import type { PriceDataPoint } from './dexscreener'

/**
 * CoinGecko client instance
 */
const client = new Coingecko({
    logLevel: 'warn', // Only show warnings and errors
    environment: 'demo',
    demoAPIKey: 'CG-a5AfanYo1RB7G2bW2j4APdB7'
})

/**
 * CoinGecko coin list item
 * Matches the SDK response type
 */
type CoinListItem = {
    id?: string
    symbol?: string
    name?: string
}

/**
 * In-memory cache for the coin list
 * This avoids fetching the full list on every lookup
 */
let coinListCache: CoinListItem[] | null = null
let coinListCacheTime: number = 0
const COIN_LIST_CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Fetch the complete list of all coins from CoinGecko
 * Results are cached for 24 hours to avoid excessive API calls
 * @returns Array of coin list items with id, symbol, and name
 */
export async function getCoinList(): Promise<CoinListItem[]> {
    // Return cached data if still valid
    const now = Date.now()
    if (coinListCache && (now - coinListCacheTime) < COIN_LIST_CACHE_DURATION) {
        return coinListCache
    }

    try {
        const response = await client.coins.list.get({
            include_platform: false, // We don't need platform info for the list
        })

        // Filter out any items without required fields and ensure types
        const validCoins = response.filter(
            (coin): coin is CoinListItem & { id: string; symbol: string; name: string } =>
                !!coin.id && !!coin.symbol && !!coin.name
        )

        coinListCache = validCoins
        coinListCacheTime = now

        console.log('[getCoinList] Fetched coin list from CoinGecko:', {
            totalCoins: validCoins.length,
        })

        return validCoins
    } catch (error: any) {
        console.error('[getCoinList] Error fetching coin list:', error?.message || error)
        // Return cached data even if expired, if available
        if (coinListCache) {
            console.warn('[getCoinList] Using expired cache due to API error')
            return coinListCache
        }
        return []
    }
}

/**
 * Search for a coin ID by symbol or name
 * Uses the coin list catalog to find matching coins
 * @param query - Symbol or name to search for (case-insensitive)
 * @returns Coin ID if found, null otherwise
 */
export async function findCoinIdBySymbolOrName(query: string): Promise<string | null> {
    const normalizedQuery = query.toLowerCase().trim()

    if (!normalizedQuery) {
        return null
    }

    try {
        const coinList = await getCoinList()

        // First try exact symbol match (case-insensitive)
        const exactSymbolMatch = coinList.find(
            (coin) => coin.symbol?.toLowerCase() === normalizedQuery
        )
        if (exactSymbolMatch?.id) {
            return exactSymbolMatch.id
        }

        // Then try partial name match
        const nameMatch = coinList.find(
            (coin) => coin.name?.toLowerCase().includes(normalizedQuery)
        )
        if (nameMatch?.id) {
            return nameMatch.id
        }

        // Finally try partial symbol match
        const partialSymbolMatch = coinList.find(
            (coin) => coin.symbol?.toLowerCase().includes(normalizedQuery)
        )
        if (partialSymbolMatch?.id) {
            return partialSymbolMatch.id
        }

        return null
    } catch (error) {
        console.error('[findCoinIdBySymbolOrName] Error searching coin list:', error)
        return null
    }
}

/**
 * Get CoinGecko coin ID from token address
 * First tries the map, then attempts to use CoinGecko's contract address lookup via SDK
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID (default: 'arbitrum-one')
 * @returns Coin ID or null if not found
 */
async function getCoinIdFromAddress(
    tokenAddress: string,
    chainId: string = 'arbitrum-one'
): Promise<string | null> {
    const address = tokenAddress.toLowerCase()

    // Try CoinGecko's contract address lookup via SDK
    try {
        console.log('[getCoinIdFromAddress] Attempting contract lookup via SDK:', { chainId, address })
        // @ts-expect-error - SDK method signature may vary, trying with separate args
        const response = await client.coins.contract.get(chainId, address)

        if (response?.id) {
            console.log('[getCoinIdFromAddress] Found coin ID via contract lookup:', response.id)
            return response.id
        }
    } catch (error: any) {
        // SDK throws errors for 404s and other API errors
        if (error?.status === 404) {
            console.log('[getCoinIdFromAddress] Contract not found in CoinGecko')
        } else {
            console.warn('[getCoinIdFromAddress] Contract lookup failed:', error?.message || error)
        }
    }

    return null
}

/**
 * OHLC data point from CoinGecko
 */
type OHLCDataPoint = {
    timestamp: number
    open: number
    high: number
    low: number
    close: number
}

/**
 * Get OHLC (Open, High, Low, Close) data from CoinGecko using SDK
 * OHLC provides better granularity than market_chart for shorter timeframes
 * @param coinId - CoinGecko coin ID (e.g., 'ethereum', 'weth')
 * @param days - Number of days of historical data (1, 7, 14, 30, 90, 180, 365)
 * @returns Array of OHLC data points
 */
async function getCoinGeckoOHLC(
    coinId: string,
    days: number
): Promise<OHLCDataPoint[]> {
    try {
        // CoinGecko OHLC endpoint supports: 1, 7, 14, 30, 90, 180, 365 days
        // It returns candlestick data with better granularity than market_chart
        // Map days to valid OHLC values
        let ohlcDays: '1' | '7' | '14' | '30' | '90' | '180' | '365'
        if (days <= 1) {
            ohlcDays = '1'
        } else if (days <= 7) {
            ohlcDays = '7'
        } else if (days <= 14) {
            ohlcDays = '14'
        } else if (days <= 30) {
            ohlcDays = '30'
        } else if (days <= 90) {
            ohlcDays = '90'
        } else if (days <= 180) {
            ohlcDays = '180'
        } else {
            ohlcDays = '365'
        }

        const response = await client.coins.ohlc.get(coinId, {
            vs_currency: 'usd',
            days: ohlcDays,
        })

        // OHLC format: [[timestamp, open, high, low, close], ...]
        // Timestamps are in milliseconds
        const ohlcData: OHLCDataPoint[] = (response || []).map((candle: number[]) => {
            const [timestamp, open, high, low, close] = candle
            return {
                timestamp,
                open,
                high,
                low,
                close,
            }
        })

        // Sort by timestamp to ensure chronological order
        ohlcData.sort((a, b) => a.timestamp - b.timestamp)

        return ohlcData
    } catch (error: any) {
        // OHLC endpoint requires API key (Pro or Demo tier)
        // Silently skip if authentication is required (free tier limitation)
        if (error?.message?.includes('authentication') || error?.message?.includes('API key')) {
            console.log('[getCoinGeckoOHLC] OHLC requires API key (Pro/Demo tier), skipping')
        } else if (error?.status === 404) {
            console.log('[getCoinGeckoOHLC] Coin not found:', coinId)
        } else {
            console.warn('[getCoinGeckoOHLC] Error fetching OHLC data:', error?.message || error)
        }
        return []
    }
}

/**
 * Get historical price data from CoinGecko using SDK
 * Tries OHLC first for better granularity, falls back to market_chart
 * @param coinId - CoinGecko coin ID (e.g., 'ethereum', 'weth')
 * @param days - Number of days of historical data (1, 7, 30, 90, 180, 365, max)
 * @returns Array of price data points (using close price from OHLC or price from market_chart)
 */
async function getCoinGeckoPriceHistory(
    coinId: string,
    days: number
): Promise<PriceDataPoint[]> {
    // Try OHLC first for better granularity (especially for shorter timeframes)
    // Note: OHLC requires Pro/Demo API key - will fall back to market_chart if not available
    if (days <= 365) {
        const ohlcData = await getCoinGeckoOHLC(coinId, days)
        if (ohlcData.length > 0) {
            // Convert OHLC to PriceDataPoint using close prices
            const priceData: PriceDataPoint[] = ohlcData.map((candle) => ({
                timestamp: candle.timestamp,
                price: candle.close, // Use close price for the chart
            }))

            console.log('[getCoinGeckoPriceHistory] Using OHLC data:', {
                coinId,
                days,
                dataPoints: priceData.length,
            })

            return priceData
        }
        // If OHLC returned empty (likely due to API key requirement), continue to market_chart
    }

    // Fallback to market_chart if OHLC is not available or for longer timeframes
    try {
        // CoinGecko `market_chart` only supports `interval=daily` (hourly isn't a supported value).
        // If you omit `interval`, CoinGecko returns higher-granularity data automatically (when available),
        // which is what we want for 24H/7D/1M charts.
        const response = await client.coins.marketChart.get(coinId, {
            vs_currency: 'usd',
            days: days.toString(),
            ...(days > 90 && { interval: 'daily' as const }),
        })

        // Extract prices array from response
        // Response format: { prices: [[timestamp, price], ...], market_caps: [...], total_volumes: [...] }
        const prices = response.prices || []

        // Convert to PriceDataPoint format and ensure data is sorted by timestamp
        // prices is an array of [number, number] tuples
        const priceData: PriceDataPoint[] = prices.map((pricePoint: number[]) => {
            const [timestamp, price] = pricePoint
            return {
                timestamp,
                price,
            }
        })

        // Sort by timestamp to ensure chronological order
        priceData.sort((a, b) => a.timestamp - b.timestamp)

        console.log('[getCoinGeckoPriceHistory] Using market_chart data:', {
            coinId,
            days,
            dataPoints: priceData.length,
        })

        return priceData
    } catch (error: any) {
        if (error?.status === 404) {
            console.log('[getCoinGeckoPriceHistory] Coin not found:', coinId)
        } else {
            console.error('[getCoinGeckoPriceHistory] Error fetching price history:', error?.message || error)
        }
        return []
    }
}

/**
 * Get historical price data for a token
 * Tries to find coin ID by symbol/name first (CoinGecko's primary identifier),
 * then falls back to contract address lookup
 * @param tokenAddress - Token contract address
 * @param tokenSymbol - Token symbol (e.g., 'RAIN', 'WETH', 'WBTC')
 * @param timeRange - Time range for the chart
 * @returns Array of price data points
 */
export async function getCoinGeckoPriceData(
    tokenAddress: string,
    timeRange: '24H' | '7D' | '1M' | '3M',
    tokenSymbol?: string
): Promise<PriceDataPoint[]> {
    let coinId: string | null = null

    // First, try to find coin ID by symbol/name (CoinGecko's primary identifier)
    // This is more reliable than contract address lookup
    if (tokenSymbol) {
        coinId = await findCoinIdBySymbolOrName(tokenSymbol)
        if (coinId) {
            console.log('[getCoinGeckoPriceData] Found coin ID by symbol/name:', { symbol: tokenSymbol, coinId })
        }
    }

    // If symbol lookup failed, try contract address lookup
    if (!coinId) {
        coinId = await getCoinIdFromAddress(tokenAddress)
    }

    if (!coinId) {
        console.log('[getCoinGeckoPriceData] No coin ID found:', { address: tokenAddress, symbol: tokenSymbol })
        return []
    }

    // Map timeRange to days
    let days: number
    switch (timeRange) {
        case '24H':
            days = 1
            break
        case '7D':
            days = 7
            break
        case '1M':
            days = 30
            break
        case '3M':
            days = 90
            break
    }

    const priceData = await getCoinGeckoPriceHistory(coinId, days)

    if (priceData.length > 0) {
        console.log('[getCoinGeckoPriceData] Fetched data from CoinGecko:', {
            coinId,
            timeRange,
            days,
            dataPoints: priceData.length,
            firstTimestamp: new Date(priceData[0]?.timestamp || 0).toISOString(),
            lastTimestamp: new Date(priceData[priceData.length - 1]?.timestamp || 0).toISOString(),
        })
    }

    return priceData
}
