import { Button } from '@/components/ui/button'

type DepositAmountDisplayProps = {
	displayValue: string
	isValid: boolean
	error: string | null
	isProcessing: boolean
	quickAmounts: number[]
	selectedAmount: string
	onQuickAmount: (value: number) => void
}

export function DepositAmountDisplay({
	displayValue,
	isValid,
	error,
	isProcessing,
	quickAmounts,
	selectedAmount,
	onQuickAmount,
}: DepositAmountDisplayProps) {
	return (
		<>
			<div className="flex flex-1 flex-col items-center justify-center px-4">
				<p
					className={`text-6xl numeric-balance tracking-tight transition-colors ${
						isValid ? 'text-foreground' : 'text-muted-foreground/30'
					}`}
				>
					${displayValue}
				</p>
				{error && (
					<p className="text-sm text-destructive font-medium mt-2 text-center max-w-xs">
						{error}
					</p>
				)}
				{isProcessing && (
					<p className="text-sm text-muted-foreground font-medium mt-2">
						Processing deposit...
					</p>
				)}
			</div>

			<div className="flex items-center justify-center gap-2 px-4 pb-4 flex-wrap">
				{quickAmounts.map((val) => (
					<Button
						key={val}
						type="button"
						variant={selectedAmount === val.toString() ? 'default' : 'secondary'}
						size="sm"
						onClick={() => onQuickAmount(val)}
						className="numeric rounded-full tap-scale"
					>
						${val}
					</Button>
				))}
			</div>
		</>
	)
}
