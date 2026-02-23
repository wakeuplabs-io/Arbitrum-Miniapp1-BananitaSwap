import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TokenIcon } from '@/components/swap/token-icon'
import { PairPriceChart, type ChartTimeRange } from '@/components/swap/pair-price-chart'
import { TOKENS } from '@/lib/tokens'
import type { Token } from '@/lib/tokens'

export const Route = createFileRoute('/token/$symbol')({
	component: TokenDetailPage,
	validateSearch: (search: Record<string, unknown>) => ({
		from: (search.from as string) || 'swap',
	}),
})

const CHART_TIME_RANGES: { value: ChartTimeRange; label: string }[] = [
	{ value: '24H', label: '24H' },
	{ value: '7D', label: '7D' },
	{ value: '1M', label: '1M' },
	{ value: '3M', label: '3M' },
]

function TokenDetailPage() {
	const { symbol } = Route.useParams()
	const navigate = useNavigate()
	const token = TOKENS.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase()) as Token | undefined
	const [chartRange, setChartRange] = useState<ChartTimeRange>('24H')

	if (!token || token.symbol === 'USDC') {
		return (
			<div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
				<p className="text-muted-foreground">Token not found</p>
				<Button variant="outline" onClick={() => navigate({ to: '/swap' })}>
					Back to Swap
				</Button>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-background pb-24">
			{/* Header */}
			<header className="sticky top-0 z-40 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={() => navigate({ to: '/swap' })}
					aria-label="Back"
					className="rounded-full shrink-0"
				>
					<ArrowLeft className="w-5 h-5 text-foreground" />
				</Button>
				<TokenIcon symbol={token.symbol} color={token.color} logoUrl={token.logoUrl} size={36} />
				<div className="flex flex-col min-w-0 flex-1">
					<h1 className="text-lg font-display font-bold text-foreground truncate">
						{token.name}
					</h1>
					<p className="text-sm numeric font-semibold text-foreground">
						${token.price < 1 ? token.price.toFixed(4) : token.price.toFixed(2)}
					</p>
				</div>
			</header>

			<div className="px-4 pt-6">
				{/* Chart */}
				<div className="bg-card rounded-2xl border-2 border-border overflow-hidden mb-6">
					<div className="px-4 pt-3 pb-1">
						<p className="text-xs font-display font-bold uppercase text-muted-foreground">
							USDC / {token.symbol}
						</p>
					</div>
					<div className="px-4 py-4">
						<PairPriceChart
							baseSymbol="USDC"
							quoteToken={token}
							timeRange={chartRange}
						/>
					</div>
					<div className="flex gap-2 px-4 pb-4 pt-2">
						{CHART_TIME_RANGES.map(({ value, label }) => (
							<Button
								key={value}
								type="button"
								variant="outline"
								size="xs"
								onClick={() => setChartRange(value)}
								className={`shrink-0 rounded-xl ${
									chartRange === value
										? 'border-border bg-background font-bold text-foreground'
										: 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
								}`}
							>
								{label}
							</Button>
						))}
					</div>
				</div>

				{/* Token info */}
				<div className="bg-card rounded-2xl border-2 border-border p-4 mb-6">
					<p className="text-xs font-display font-medium uppercase text-muted-foreground mb-2">
						Token info
					</p>
					<p className="text-sm text-foreground">
						{token.symbol} · {token.marketCap} Market Cap
					</p>
					<p
						className={`text-sm mt-1 ${token.change24h >= 0 ? 'text-success' : 'text-destructive'}`}
					>
						{token.change24h >= 0 ? '+' : ''}
						{token.change24h.toFixed(2)}% (24h)
					</p>
				</div>

				{/* Buy / Sell buttons */}
				<div className="flex gap-3">
					<Button
						type="button"
						variant="success"
						className="flex-1 rounded-full font-display font-bold uppercase py-6"
						onClick={() =>
							navigate({
								to: '/swap',
								search: { token: token.symbol, mode: 'buy' },
							})
						}
					>
						Buy
					</Button>
					<Button
						type="button"
						variant="destructive"
						className="flex-1 rounded-full font-display font-bold uppercase py-6"
						onClick={() =>
							navigate({
								to: '/swap',
								search: { token: token.symbol, mode: 'sell' },
							})
						}
					>
						Sell
					</Button>
				</div>
			</div>
		</div>
	)
}
