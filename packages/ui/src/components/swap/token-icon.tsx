import { useState } from 'react'

type TokenIconProps = {
	symbol: string
	color: string
	logoUrl?: string
	size?: number
}

export function TokenIcon({ symbol, color, logoUrl, size = 36 }: TokenIconProps) {
	const [imgError, setImgError] = useState(false)
	const showFallback = !logoUrl || imgError

	const iconMap: Record<string, string> = {
		USDC: '$',
		ETH: 'E',
		WBTC: 'B',
		ARB: 'A',
		SOL: 'S',
		BONK: 'B',
	}

	if (!showFallback) {
		return (
			<img
				src={logoUrl}
				alt={symbol}
				width={size}
				height={size}
				className="rounded-full shrink-0 object-cover"
				onError={() => setImgError(true)}
			/>
		)
	}

	return (
		<div
			className="flex items-center justify-center rounded-full shrink-0"
			style={{
				width: size,
				height: size,
				backgroundColor: color,
			}}
		>
			<span
				className="font-display font-bold"
				style={{
					fontSize: size * 0.4,
					color: '#fff',
				}}
			>
				{iconMap[symbol] || symbol[0]}
			</span>
		</div>
	)
}
