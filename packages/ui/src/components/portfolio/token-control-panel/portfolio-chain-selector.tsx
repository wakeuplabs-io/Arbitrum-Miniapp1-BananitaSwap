import { Button } from '@/components/ui/button'

type Chain = 'sepolia' | 'mainnet'

type PortfolioChainSelectorProps = {
	value: Chain
	onChange: (chain: Chain) => void
}

export function PortfolioChainSelector({ value, onChange }: PortfolioChainSelectorProps) {
	return (
		<div>
			<h4 className="text-xs font-display font-semibold uppercase tracking-wide text-foreground mb-2">
				Portfolio chain
			</h4>
			<p className="text-[10px] text-muted-foreground mb-2">
				Chain used for portfolio, mock sync, withdraw, and deposit.
			</p>
			<div className="flex rounded-full border border-border bg-muted/50 p-0.5 w-fit">
				<Button
					type="button"
					variant={value === 'sepolia' ? 'default' : 'ghost'}
					size="xs"
					onClick={() => onChange('sepolia')}
					className="rounded-full"
				>
					Sepolia
				</Button>
				<Button
					type="button"
					variant={value === 'mainnet' ? 'default' : 'ghost'}
					size="xs"
					onClick={() => onChange('mainnet')}
					className="rounded-full"
				>
					Mainnet
				</Button>
			</div>
		</div>
	)
}
