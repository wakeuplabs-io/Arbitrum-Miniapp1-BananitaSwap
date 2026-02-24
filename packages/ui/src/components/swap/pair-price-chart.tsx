import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import type { Token } from '@/lib/tokens'
import { usePriceChartData } from '@/hooks/use-price-chart-data'

export type ChartTimeRange = '24H' | '7D' | '1M' | '3M'

type PairPriceChartProps = {
	baseSymbol: string
	quoteToken: Token
	/** Time range for the chart */
	timeRange?: ChartTimeRange
}

type TooltipData = {
	x: number
	y: number
	price: number
	timestamp: number
	visible: boolean
}

/**
 * Format price for display
 */
function formatPrice(price: number): string {
	if (price === 0) return '$0.00'
	if (price < 0.01) return `$${price.toFixed(6)}`
	if (price < 1) return `$${price.toFixed(4)}`
	return `$${price.toFixed(2)}`
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp: number, timeRange: ChartTimeRange): string {
	const date = new Date(timestamp)
	const now = new Date()

	if (timeRange === '24H') {
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
		})
	}

	if (timeRange === '7D') {
		const daysAgo = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000))
		if (daysAgo === 0) return 'Today'
		if (daysAgo === 1) return 'Yesterday'
		return `${daysAgo} days ago`
	}

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
	})
}

/**
 * Price chart for a pair. Axes: X = time (left to right), Y = price (bottom to top).
 * Supports touch and mouse interaction to view prices at different points in time.
 */
export function PairPriceChart({
	baseSymbol,
	quoteToken,
	timeRange = '24H',
}: PairPriceChartProps) {
	const { data: priceData = [], isLoading, isFetched } = usePriceChartData({
		token: quoteToken,
		timeRange,
	})

	// Debug: Log when data changes
	useEffect(() => {
		console.log('[PairPriceChart] Data received:', {
			timeRange,
			token: quoteToken?.symbol,
			dataLength: priceData.length,
			isLoading,
			firstPrice: priceData[0]?.price,
			lastPrice: priceData[priceData.length - 1]?.price,
			priceRange: priceData.length > 0 ? {
				min: Math.min(...priceData.map(d => d.price)),
				max: Math.max(...priceData.map(d => d.price)),
			} : null,
		})
	}, [priceData, timeRange, quoteToken?.symbol, isLoading])

	const [tooltip, setTooltip] = useState<TooltipData & { chartX?: number }>({
		x: 0,
		y: 0,
		price: 0,
		timestamp: 0,
		visible: false,
		chartX: 0,
	})

	const svgRef = useRef<SVGSVGElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)

	const isPositive = quoteToken.change24h >= 0
	const width = 360
	const height = 160

	// Convert price data to chart coordinates
	// Use standard price range scaling with better padding for smoother visualization
	const chartPoints = useMemo(() => {
		if (priceData.length === 0) {
			return []
		}

		const prices = priceData.map((d) => d.price)
		const minPrice = Math.min(...prices)
		const maxPrice = Math.max(...prices)
		const priceRange = maxPrice - minPrice

		// For very small price ranges (less than 1% of average), use percentage-based padding
		// For larger ranges, use absolute padding
		const avgPrice = (minPrice + maxPrice) / 2
		const isSmallRange = priceRange < avgPrice * 0.01 // Less than 1% of average

		let padding: number
		let paddedMin: number
		let paddedMax: number

		if (isSmallRange && avgPrice > 0) {
			// Use percentage-based padding for small ranges (5% of average price)
			padding = avgPrice * 0.05
			paddedMin = minPrice - padding
			paddedMax = maxPrice + padding
		} else {
			// Use absolute padding: 15% of the range on each side, minimum 1% of average
			padding = Math.max(priceRange * 0.15, avgPrice * 0.01)
			paddedMin = minPrice - padding
			paddedMax = maxPrice + padding
		}

		const paddedRange = paddedMax - paddedMin || 1 // Avoid division by zero

		return priceData.map((point, index) => {
			const x = (index / (priceData.length - 1)) * width
			const normalizedPrice = (point.price - paddedMin) / paddedRange
			const y = height - normalizedPrice * height
			return {
				x,
				y,
				price: point.price,
				timestamp: point.timestamp,
			}
		})
	}, [priceData, width, height])

	const pathD = useMemo(() => {
		if (chartPoints.length === 0) return ''
		return chartPoints
			.map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
			.join(' ')
	}, [chartPoints])

	const areaD = useMemo(() => {
		if (!pathD) return ''
		return `${pathD} L ${width} ${height} L 0 ${height} Z`
	}, [pathD, width, height])

	const color = isPositive ? 'oklch(0.696 0.17 162.48)' : 'oklch(0.577 0.245 27.325)'
	const fillColor = isPositive
		? 'oklch(0.696 0.17 162.48 / 0.15)'
		: 'oklch(0.577 0.245 27.325 / 0.15)'

	const gradientId = useMemo(
		() => `pair-chart-grad-${baseSymbol}-${quoteToken.symbol}`.replace(/\s/g, '-'),
		[baseSymbol, quoteToken.symbol]
	)

	// Find the closest point to the mouse/touch position
	const findClosestPoint = useCallback(
		(clientX: number): { price: number; timestamp: number; x: number; y: number; chartX: number } | null => {
			if (!containerRef.current || chartPoints.length === 0) {
				return null
			}

			const rect = containerRef.current.getBoundingClientRect()
			const x = clientX - rect.left
			const relativeX = (x / rect.width) * width

			// Find the closest point
			let closestIndex = 0
			let minDistance = Math.abs(chartPoints[0].x - relativeX)

			for (let i = 1; i < chartPoints.length; i++) {
				const distance = Math.abs(chartPoints[i].x - relativeX)
				if (distance < minDistance) {
					minDistance = distance
					closestIndex = i
				}
			}

			const point = chartPoints[closestIndex]
			return {
				price: point.price,
				timestamp: point.timestamp,
				x: (point.x / width) * rect.width,
				y: (point.y / height) * rect.height,
				chartX: point.x,
			}
		},
		[chartPoints, width, height]
	)

	const handlePointerMove = useCallback(
		(e: React.PointerEvent | PointerEvent) => {
			const point = findClosestPoint(e.clientX)
			if (point) {
				setTooltip({
					x: point.x,
					y: point.y,
					price: point.price,
					timestamp: point.timestamp,
					visible: true,
					chartX: point.chartX,
				})
			}
		},
		[findClosestPoint]
	)

	const handlePointerLeave = useCallback(() => {
		setTooltip((prev) => ({ ...prev, visible: false }))
	}, [])

	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			if (e.touches.length > 0) {
				const touch = e.touches[0]
				const point = findClosestPoint(touch.clientX)
				if (point) {
					setTooltip({
						x: point.x,
						y: point.y,
						price: point.price,
						timestamp: point.timestamp,
						visible: true,
						chartX: point.chartX,
					})
				}
			}
		},
		[findClosestPoint]
	)

	const handleTouchEnd = useCallback(() => {
		// Keep tooltip visible for a moment after touch ends
		setTimeout(() => {
			setTooltip((prev) => ({ ...prev, visible: false }))
		}, 1000)
	}, [])

	if (isLoading) {
		return (
			<div className="w-full h-40 flex items-center justify-center">
				<div className="text-sm text-muted-foreground">Loading chart...</div>
			</div>
		)
	}

	if (isFetched && chartPoints.length === 0) {
		return (
			<div className="w-full h-40 flex items-center justify-center">
				<div className="text-sm text-muted-foreground text-center px-4">
					Historical price data not available for this token
				</div>
			</div>
		)
	}

	return (
		<div
			ref={containerRef}
			className="relative w-full"
			onPointerMove={handlePointerMove}
			onPointerLeave={handlePointerLeave}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
		>
			<svg
				ref={svgRef}
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
				{tooltip.visible && tooltip.chartX !== undefined && (
					<g>
						{/* Vertical line */}
						<line
							x1={tooltip.chartX}
							y1={0}
							x2={tooltip.chartX}
							y2={height}
							stroke="currentColor"
							strokeWidth="1"
							strokeDasharray="4 4"
							opacity={0.3}
							className="text-muted-foreground"
						/>
						{/* Point marker */}
						{(() => {
							const point = chartPoints.find(
								(p) => Math.abs(p.timestamp - tooltip.timestamp) < 1000
							) || chartPoints[0]
							return (
								<circle
									cx={point.x}
									cy={point.y}
									r="4"
									fill={color}
									stroke="white"
									strokeWidth="2"
								/>
							)
						})()}
					</g>
				)}
			</svg>
			{tooltip.visible && (
				<div
					className="absolute pointer-events-none z-10 bg-background border border-border rounded-lg px-2 py-1 shadow-lg text-xs"
					style={{
						left: `${Math.min(Math.max(tooltip.x - 60, 10), (containerRef.current?.getBoundingClientRect().width || width) - 130)}px`,
						top: `${Math.max(Math.min(tooltip.y - 50, (containerRef.current?.getBoundingClientRect().height || height) - 60), 10)}px`,
					}}
				>
					<div className="font-semibold text-foreground">{formatPrice(tooltip.price)}</div>
					<div className="text-muted-foreground">{formatTime(tooltip.timestamp, timeRange)}</div>
				</div>
			)}
		</div>
	)
}
