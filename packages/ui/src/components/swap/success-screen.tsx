import { Button } from '@/components/ui/button'

type SuccessScreenProps = {
	title: string
	message?: string
	onDismiss: () => void
	buttonLabel?: string
	imageSrc?: string
	imageAlt?: string
}

export function SuccessScreen({
	title,
	message,
	onDismiss,
	buttonLabel = 'Done',
	imageSrc = '/success-monkey.webp',
	imageAlt = 'Monkey depositing coin into pouch',
}: SuccessScreenProps) {
	return (
		<div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md animate-fade-in-up px-6 max-w-[430px] mx-auto">
			<div className="flex flex-col items-center gap-4 text-center">
				<div className="flex items-center justify-center w-full max-w-[200px] animate-check-bounce" aria-hidden>
					<img
						src={imageSrc}
						alt={imageAlt}
						className="w-full h-auto object-contain"
					/>
				</div>
				<h2 className="text-xl font-display font-bold uppercase tracking-wide text-foreground">
					{title}
				</h2>
				{message && (
					<p className="text-sm text-muted-foreground max-w-[280px]">{message}</p>
				)}
			</div>
			<Button
				type="button"
				variant="default"
				size="xl"
				onClick={onDismiss}
				className="btn-gradient-shine mt-8 w-full max-w-[280px] rounded-full font-display font-bold uppercase !bg-gradient-to-r !from-[#FFC700] !to-[#FFA500] hover:!from-[#FFD000] hover:!to-[#FFB020] !text-[#0A0A0A] !border-0 !shadow-[0_4px_14px_rgba(255,199,0,0.4)] hover:!shadow-[0_6px_20px_rgba(255,199,0,0.5)] focus-visible:!ring-2 focus-visible:!ring-[#FFC700] focus-visible:!ring-offset-2"
			>
				{buttonLabel}
			</Button>
		</div>
	)
}
