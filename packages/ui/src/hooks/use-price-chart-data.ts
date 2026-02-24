import { useQuery } from '@tanstack/react-query'
import type { PriceDataPoint } from '@/services/dexscreener'
import { getCoinGeckoPriceData } from '@/services/coingecko'
import type { Token } from '@/lib/tokens'
import type { ChartTimeRange } from '@/components/swap/pair-price-chart'

type UsePriceChartDataParams = {
    token: Token | null
    timeRange: ChartTimeRange
}

/**
 * Hook to fetch historical price data for a token pair
 * Fetches real price data from CoinGecko only - returns empty array if data unavailable
 */
export function usePriceChartData({ token, timeRange }: UsePriceChartDataParams) {
    return useQuery({
        queryKey: ['price-chart-data', token?.address, timeRange],
        queryFn: async (): Promise<PriceDataPoint[]> => {
            console.log('[usePriceChartData] Fetching data for:', {
                token: token?.symbol,
                address: token?.address,
                timeRange,
                currentPrice: token?.price,
                change24h: token?.change24h,
            })

            if (!token?.address) {
                console.log('[usePriceChartData] No token address, returning empty array')
                return []
            }


            // Try CoinGecko first for valid addresses (including zero address for native ETH)
            // Pass token symbol to use CoinGecko's primary identifier (coin name) instead of contract address
            console.log('[usePriceChartData] Attempting to fetch data from CoinGecko...')
            const coinGeckoData = await getCoinGeckoPriceData(token.address, timeRange, token.symbol)

            if (coinGeckoData.length > 0) {
                console.log('[usePriceChartData] CoinGecko returned data, processing...')
                // Filter data to only include points within the requested timeframe
                const now = Date.now()
                let timeWindow: number
                switch (timeRange) {
                    case '24H':
                        timeWindow = 24 * 60 * 60 * 1000
                        break
                    case '7D':
                        timeWindow = 7 * 24 * 60 * 60 * 1000
                        break
                    case '1M':
                        timeWindow = 30 * 24 * 60 * 60 * 1000
                        break
                    case '3M':
                        timeWindow = 90 * 24 * 60 * 60 * 1000
                        break
                }

                const cutoffTime = now - timeWindow
                // Filter to only include data within the time window and ensure it's sorted
                const filteredCoinGeckoData = coinGeckoData
                    .filter((point) => point.timestamp >= cutoffTime && point.timestamp <= now)
                    .sort((a, b) => a.timestamp - b.timestamp)

                // Ensure we have valid price data (no NaN or invalid values)
                const validData = filteredCoinGeckoData.filter(
                    (point) =>
                        !isNaN(point.price) &&
                        isFinite(point.price) &&
                        point.price > 0 &&
                        !isNaN(point.timestamp) &&
                        isFinite(point.timestamp)
                )

                if (validData.length >= 10) {
                    // Minimum 10 points for CoinGecko data
                    console.log('[usePriceChartData] Using CoinGecko data:', {
                        timeRange,
                        dataPoints: validData.length,
                        originalDataPoints: coinGeckoData.length,
                        filteredDataPoints: filteredCoinGeckoData.length,
                        firstPrice: validData[0]?.price,
                        lastPrice: validData[validData.length - 1]?.price,
                        firstTimestamp: new Date(validData[0]?.timestamp || 0).toISOString(),
                        lastTimestamp: new Date(validData[validData.length - 1]?.timestamp || 0).toISOString(),
                    })
                    return validData
                } else {
                    console.warn('[usePriceChartData] CoinGecko data insufficient after filtering:', {
                        timeRange,
                        originalDataPoints: coinGeckoData.length,
                        filteredDataPoints: filteredCoinGeckoData.length,
                        validDataPoints: validData.length,
                    })
                }
            } else {
                console.log('[usePriceChartData] CoinGecko returned no data (token may not be in CoinGecko)')
            }

            // Return empty array if no data available - chart will show message instead
            console.log('[usePriceChartData] No data available, returning empty array')
            return []
        },
        enabled: !!token?.address,
        staleTime: 0, // Always refetch when timeframe changes
        refetchInterval: false, // Don't auto-refetch, only refetch on timeframe change
    })
}
