import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Token } from '@/lib/tokens'

type AddTokenFormProps = {
	availableTokens: Token[]
	selectedSymbol: string
	amount: string
	onSelectSymbol: (symbol: string) => void
	onAmountChange: (value: string) => void
	onAdd: () => void
}

export function AddTokenForm({
	availableTokens,
	selectedSymbol,
	amount,
	onSelectSymbol,
	onAmountChange,
	onAdd,
}: AddTokenFormProps) {
	return (
		<div>
			<h4 className="text-xs font-display font-semibold uppercase tracking-wide text-foreground mb-2">
				Add Token
			</h4>
			<div className="space-y-2">
				<select
					value={selectedSymbol}
					onChange={(e) => onSelectSymbol(e.target.value)}
					className="w-full h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<option value="">Select a token...</option>
					{availableTokens.map((token) => (
						<option key={token.symbol} value={token.symbol}>
							{token.symbol} - {token.name}
						</option>
					))}
				</select>
				<div className="flex gap-2">
					<Input
						type="number"
						value={amount}
						onChange={(e) => onAmountChange(e.target.value)}
						placeholder="Amount"
						step="0.01"
						min="0"
						className="flex-1 h-8 text-xs"
					/>
					<Button
						type="button"
						variant="default"
						size="xs"
						onClick={onAdd}
						disabled={!selectedSymbol || !amount}
						className="rounded-full"
					>
						<Plus className="h-3 w-3" />
					</Button>
				</div>
			</div>
		</div>
	)
}
