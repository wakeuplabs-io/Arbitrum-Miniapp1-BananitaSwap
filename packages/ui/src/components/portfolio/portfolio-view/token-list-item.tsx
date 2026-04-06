import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { TokenIcon } from '@/components/swap/token-icon'
import { formatPrice, formatTokenAmount } from '@/lib/utils'
import type { Token } from '@/lib/tokens'

type Holding = {
	token: Token
	amount: number
}

type TokenListItemProps = {
	holding: Holding
	onBuyToken: (token: Token) => void
	onSellToken: (token: Token) => void
}

function unitUsdPriceForHolding(token: Token): number {
	if (token.symbol === 'USDC' || token.symbol === 'USDC.e') return 1
	const p = token.price
	return Number.isFinite(p) && p > 0 ? p : 0
}

export function TokenListItem({ holding, onBuyToken, onSellToken }: TokenListItemProps) {
	const navigate = useNavigate()
	const usdValue = holding.amount * unitUsdPriceForHolding(holding.token)

	function handleClick() {
		navigate({
			to: '/swap',
			search: { token: holding.token.symbol, mode: 'buy' }
		})
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			handleClick()
		}
	}

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			className="flex items-center gap-2 sm:gap-4 py-3 sm:py-4 px-3 sm:px-4 rounded-3xl bg-card border-2 border-border w-full min-w-0 text-left cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring tap-scale transition-transform"
		>
			<TokenIcon
				symbol={holding.token.symbol}
				color={holding.token.color}
				logoUrl={holding.token.logoUrl}
				size={36}
			/>

			<div className="flex flex-col min-w-0 flex-1 gap-1 overflow-hidden">
				<span className="text-sm font-display font-semibold text-foreground truncate block min-w-0">
					{holding.token.name}
				</span>
				<span className="text-xs numeric text-muted-foreground truncate block min-w-0">
					{formatTokenAmount(holding.amount)} {holding.token.symbol}
				</span>
			</div>

			<div className="flex flex-col items-end shrink-0 gap-1">
				<span className="text-sm numeric font-bold text-foreground text-price">
					{formatPrice(usdValue)}
				</span>
				<span
					className={`text-xs numeric ${
						holding.token.change24h == null
							? 'text-muted-foreground'
							: holding.token.change24h >= 0
								? 'text-success'
								: 'text-destructive'
					}`}
				>
					{holding.token.change24h == null
						? '-'
						: `${holding.token.change24h >= 0 ? '+' : ''}${holding.token.change24h.toFixed(3)}%`}
				</span>
			</div>

			<div className="flex flex-col gap-1 shrink-0">
				<Button
					type="button"
					variant="success"
					size="xs"
					onClick={(e) => {
						e.stopPropagation()
						onBuyToken(holding.token)
					}}
					className="rounded-full min-h-[28px] h-7 px-2.5 text-xs"
				>
					Buy
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="xs"
					onClick={(e) => {
						e.stopPropagation()
						onSellToken(holding.token)
					}}
					className="rounded-full min-h-[28px] h-7 px-2.5 text-xs"
				>
					Sell
				</Button>
			</div>
		</div>
	)
}
