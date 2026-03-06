import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type DepositModalHeaderProps = {
	onClose: () => void
}

export function DepositModalHeader({ onClose }: DepositModalHeaderProps) {
	return (
		<div className="flex items-center justify-between px-4 pt-6 pb-2">
			<div className="w-11" />
			<h2 className="text-base font-display font-bold uppercase tracking-wide text-foreground">
				Deposit
			</h2>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={onClose}
				aria-label="Close"
				className="rounded-full !bg-transparent hover:!bg-transparent focus-visible:!ring-0 focus-visible:!ring-offset-0 text-muted-foreground hover:text-foreground"
			>
				<X className="w-5 h-5" />
			</Button>
		</div>
	)
}
