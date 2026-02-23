import { useMemo } from 'react'
import type { Token } from '@/lib/tokens'

/**
 * Simple seeded PRNG (mulberry32) for deterministic chart points.
 */
function seededRandom(seed: number) {
	return function next() {
		let t = (seed += 0x6d2b79f5)
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

function seedFromString(str: string): number {
	let h = 0
	for (let i = 0; i < str.length; i++) {
		h = Math.imul(31, h) + str.charCodeAt(i)
		h = (h << 0) ^ (h >>> 16)
	}
	return h >>> 0
}

export type ChartTimeRange = '24H' | '7D' | '1M' | '3M'

type PairPriceChartProps = {
	baseSymbol: string
	quoteToken: Token
	/** Time range for the chart; used in seed so each range shows a distinct curve. */
	timeRange?: ChartTimeRange
}

/**
 * Price chart for a pair. Axes: X = time (left to right), Y = price (bottom to top).
 * Time range buttons (24H, 7D, 1M, 3M) are rendered by the parent and passed as timeRange.
 */
export function PairPriceChart({
	baseSymbol,
	quoteToken,
	timeRange = '24H',
}: PairPriceChartProps) {
	const isPositive = quoteToken.change24h >= 0

	const points = useMemo(() => {
		const seed = seedFromString(`${baseSymbol}-${quoteToken.symbol}-${timeRange}`)
		const rng = seededRandom(seed)
		const pts: number[] = []
		let v = 50
		for (let i = 0; i < 60; i++) {
			v += (rng() - (isPositive ? 0.45 : 0.55)) * 6
			v = Math.max(10, Math.min(90, v))
			pts.push(v)
		}
		return pts
	}, [baseSymbol, quoteToken.symbol, isPositive, timeRange])

	const width = 360
	const height = 160
	const stepX = width / (points.length - 1)

	const pathD = points
		.map((y, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${height - (y / 100) * height}`)
		.join(' ')

	const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`

	const color = isPositive ? 'oklch(0.696 0.17 162.48)' : 'oklch(0.577 0.245 27.325)'
	const fillColor = isPositive
		? 'oklch(0.696 0.17 162.48 / 0.15)'
		: 'oklch(0.577 0.245 27.325 / 0.15)'

	const gradientId = useMemo(
		() => `pair-chart-grad-${baseSymbol}-${quoteToken.symbol}`.replace(/\s/g, '-'),
		[baseSymbol, quoteToken.symbol]
	)

	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			className="w-full"
			preserveAspectRatio="none"
			aria-label="Price chart: Y axis price in USD, X axis time"
			role="img"
		>
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={fillColor} />
					<stop offset="100%" stopColor="transparent" />
				</linearGradient>
			</defs>
			<path d={areaD} fill={`url(#${gradientId})`} />
			<path d={pathD} fill="none" stroke={color} strokeWidth="2" />
		</svg>
	)
}
