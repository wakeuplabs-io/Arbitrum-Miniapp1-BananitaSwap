import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type WalletAddressControlProps = {
	value: string
	onChange: (value: string) => void
	currentWallet: string | undefined
	onSet: () => void
	onClear: () => void
}

export function WalletAddressControl({
	value,
	onChange,
	currentWallet,
	onSet,
	onClear,
}: WalletAddressControlProps) {
	return (
		<div>
			<h4 className="text-xs font-display font-semibold uppercase tracking-wide text-foreground mb-2 flex items-center gap-2">
				<Wallet className="h-3 w-3" />
				Wallet Address
			</h4>
			<div className="space-y-2">
				<div className="flex gap-2">
					<Input
						type="text"
						value={value}
						onChange={(e) => onChange(e.target.value)}
						placeholder="0x..."
						className="flex-1 h-8 text-xs font-mono"
					/>
					<Button type="button" variant="default" size="xs" onClick={onSet} className="rounded-full">
						Set
					</Button>
					<Button
						type="button"
						variant="outline"
						size="xs"
						onClick={onClear}
						disabled={!currentWallet}
						className="rounded-full"
					>
						Clear
					</Button>
				</div>
				{currentWallet && (
					<p className="text-[10px] text-muted-foreground font-mono truncate">
						Current: {currentWallet}
					</p>
				)}
			</div>
		</div>
	)
}
