type TokenIconProps = {
	symbol: string
	color: string
	logoUrl?: string
	size?: number
}

export function TokenIcon({ symbol, color, size = 36 }: TokenIconProps) {

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
				{symbol[0]}
			</span>
		</div>
	)
}
