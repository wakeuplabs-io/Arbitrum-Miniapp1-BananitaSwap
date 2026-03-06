import { Button } from '@/components/ui/button'

type Action = {
	icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
	label: string
	onClick: () => void
}

type PortfolioActionsProps = {
	actions: Action[]
}

export function PortfolioActions({ actions }: PortfolioActionsProps) {
	return (
		<div className="flex items-center justify-center gap-8 sm:gap-12 pt-2 pb-0">
			{actions.map((action, i) => (
				<div key={action.label} className="flex flex-col items-center gap-2 icon-tap-scale">
					<Button
						type="button"
						variant="default"
						size="icon-lg"
						onClick={action.onClick}
						aria-label={action.label}
						className={`btn-gradient-shine ${i === 1 ? 'btn-gradient-shine-delay-1s' : i === 2 ? 'btn-gradient-shine-delay-2s' : ''} rounded-full size-14 min-w-14 min-h-14 p-0 flex items-center justify-center !bg-gradient-to-r !from-[#FFC700] !to-[#FFA500] hover:!from-[#FFD000] hover:!to-[#FFB020] !text-[#0A0A0A] !border-0 !shadow-[0_4px_14px_rgba(255,199,0,0.4)] hover:!shadow-[0_6px_20px_rgba(255,199,0,0.5)] focus-visible:!from-[#FFC700] focus-visible:!to-[#FFA500] focus-visible:!ring-2 focus-visible:!ring-[#FFC700] focus-visible:!ring-offset-2`}
					>
						<action.icon className="w-6 h-6 text-[#0A0A0A] shrink-0" strokeWidth={3} />
					</Button>
					<span className="text-[10px] font-display font-bold uppercase tracking-wide leading-tight text-foreground text-center">
						{action.label}
					</span>
				</div>
			))}
		</div>
	)
}
