import { useMemo } from 'react'
import type { Token } from '@/lib/tokens'

type DexScreenerEmbedChartProps = {
    token: Token | null
    timeRange?: '15' | '1H' | '4H' | '1D'
    theme?: 'dark' | 'light'
}

/**
 * DexScreener embed chart component
 * Displays an embedded price chart from DexScreener using iframe
 */
export function DexScreenerEmbedChart({
    token,
    timeRange = '1D',
}: DexScreenerEmbedChartProps) {
    const embedUrl = useMemo(() => {
        if (!token?.chainId || (!token?.address && !token?.pairAddress)) {
            return null
        }

        // Map chainId to DexScreener chain identifier
        const chainId = token.chainId.toLowerCase()
        const chainMap: Record<string, string> = {
            'arbitrum': 'arbitrum',
            'arbitrum-one': 'arbitrum',
            'ethereum': 'ethereum',
            'bsc': 'bsc',
            'polygon': 'polygon',
            'base': 'base',
        }

        const chain = chainMap[chainId] || chainId

        // Prefer token page to avoid base/quote orientation issues in some USDC pools.
        // Fallback to pair page when token address is unavailable.
        const pathTarget = token.address ?? token.pairAddress
        const url = new URL(`https://dexscreener.com/${chain}/${pathTarget}`)
        url.searchParams.set('embed', '1')
        url.searchParams.set('loadChartSettings', '0')
        url.searchParams.set('trades', '0')
        url.searchParams.set('tabs', '0')
        url.searchParams.set('info', '0')
        url.searchParams.set('chartLeftToolbar', '0')
        url.searchParams.set('chartDefaultOnMobile', '1')
        url.searchParams.set('chartTheme', 'light')
        url.searchParams.set('theme', 'light')
        url.searchParams.set('chartStyle', '1')
        url.searchParams.set('chartType', 'price')
        url.searchParams.set('interval', timeRange)

        return url.toString()
    }, [token?.address, token?.pairAddress, token?.chainId, timeRange])

    if (!embedUrl) {
        return (
            <div className="w-full h-40 flex items-center justify-center bg-card rounded-2xl border-2 border-border">
                <div className="text-sm text-muted-foreground">
                    {token ? 'Token or pair address not available for this token' : 'No token selected'}
                </div>
            </div>
        )
    }

    return (
        <div className="w-full bg-card rounded-2xl border-2 border-border shadow-sm hover:border-primary hover:shadow-xl card-lift overflow-hidden">
            <style>{`
				#dexscreener-embed {
					position: relative;
					width: 100%;
					padding-bottom: 125%;
                    height: min(calc(100vh - 158px), 700px)
				}
				@media (min-width: 1400px) {
					#dexscreener-embed {
						padding-bottom: 65%;
					}
				}
				#dexscreener-embed iframe {
					position: absolute;
					width: 100%;
					height: 100%;
					top: 0;
					left: 0;
					border: 0;
				}
			`}</style>
            <div id="dexscreener-embed">
                <iframe
                    src={embedUrl}
                    title={`DexScreener chart for ${token?.symbol || 'token'}`}
                    loading="eager"
                    allow="clipboard-read; clipboard-write"
                />
            </div>
        </div>
    )
}
