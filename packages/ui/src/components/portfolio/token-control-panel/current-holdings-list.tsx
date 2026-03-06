import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TokenIcon } from '@/components/swap/token-icon'
import type { Token } from '@/lib/tokens'

type Holding = {
	token: Token
	amount: number
}

type CurrentHoldingsListProps = {
	holdings: Holding[]
	isMocking: boolean
	onUpdateAmount: (symbol: string, amount: number) => void
	onRemove: (symbol: string) => void
}

export function CurrentHoldingsList({
	holdings,
	isMocking,
	onUpdateAmount,
	onRemove,
}: CurrentHoldingsListProps) {
	return (
		<div>
			<h4 className="text-xs font-display font-semibold uppercase tracking-wide text-foreground mb-2">
				Current Holdings
			</h4>
			<div className="space-y-2">
				{holdings.length === 0 ? (
					<p className="text-xs text-muted-foreground text-center py-4">No tokens</p>
				) : (
					holdings.map((holding) => (
						<div
							key={holding.token.symbol}
							className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border"
						>
							<TokenIcon
								symbol={holding.token.symbol}
								color={holding.token.color}
								logoUrl={holding.token.logoUrl}
								size={24}
							/>
							<div className="flex-1 min-w-0">
								<p className="text-xs font-semibold text-foreground truncate">
									{holding.token.symbol}
								</p>
								<p className="text-[10px] text-muted-foreground">
									${holding.token.price.toFixed(2)}
								</p>
							</div>
							<Input
								type="number"
								value={holding.amount}
								onChange={(e) => {
									const value = parseFloat(e.target.value)
									if (!isNaN(value) && value >= 0) {
										onUpdateAmount(holding.token.symbol, value)
									}
								}}
								step="0.01"
								min="0"
								className="w-20 h-7 text-xs"
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								onClick={() => onRemove(holding.token.symbol)}
								disabled={!isMocking && holdings.length === 1}
								className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
								aria-label={`Remove ${holding.token.symbol}`}
								title={
									!isMocking && holdings.length === 1
										? 'Cannot remove the last token when not mocking'
										: `Remove ${holding.token.symbol}`
								}
							>
								<Trash2 className="h-3 w-3" />
							</Button>
						</div>
					))
				)}
			</div>
		</div>
	)
}
