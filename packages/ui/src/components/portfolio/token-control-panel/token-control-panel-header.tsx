import { Settings2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type TokenControlPanelHeaderProps = {
	isMocking: boolean
	onClose: () => void
}

export function TokenControlPanelHeader({ isMocking, onClose }: TokenControlPanelHeaderProps) {
	return (
		<div className="flex items-center justify-between px-4 pt-6 pb-2 border-b border-border">
			<div className="flex items-center gap-2">
				<Settings2 className="h-4 w-4 text-muted-foreground" />
				<h2 className="text-base font-display font-bold uppercase tracking-wide text-foreground">
					Token Control Panel
				</h2>
				{isMocking && (
					<span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono">
						MOCK
					</span>
				)}
			</div>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={onClose}
				className="rounded-full !bg-transparent hover:!bg-transparent focus-visible:!ring-0 focus-visible:!ring-offset-0 text-muted-foreground hover:text-foreground"
				aria-label="Close panel"
			>
				<X className="h-5 w-5" />
			</Button>
		</div>
	)
}
