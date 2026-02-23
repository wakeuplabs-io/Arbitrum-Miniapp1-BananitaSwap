import { Button } from '@/components/ui/button'

type TokensEmptyStateProps = {
	onBuyNow: () => void
}

/** Banana pattern data URL for subtle background (opacity ~5–6%) */
const BANANA_PATTERN =
	"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cpath d='M20 2c-2 0-4 2-4 5 0 4 3 8 4 11 1-3 4-7 4-11 0-3-2-5-4-5z' fill='%23FFC700' opacity='0.06'/%3E%3C/svg%3E\")"

export function TokensEmptyState({ onBuyNow }: TokensEmptyStateProps) {
	return (
		<div
			className="tokens-empty-state-wrapper relative rounded-3xl pt-6 pb-12 px-6 sm:pt-8 sm:pb-14 sm:px-8"
			style={{
				background: BANANA_PATTERN,
				backgroundRepeat: 'repeat',
			}}
		>
			<div
				className="relative flex flex-col items-center justify-center pt-6 pb-12 px-6 sm:pt-8 sm:pb-14 sm:px-8 rounded-3xl bg-[#FFFFFF] text-center overflow-hidden"
				style={{
					boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
				}}
			>
				{/* A) Title */}
				<h2 className="text-base sm:text-lg font-display font-bold uppercase tracking-wide text-foreground mb-8">
					Your Tokens
				</h2>

				{/* B) Monkey illustration */}
				<div
					className="float-gentle w-full max-w-[260px] sm:max-w-[300px] mx-auto mb-8 flex justify-center"
					aria-hidden
				>
					<img
						src="/tokens-empty-monkey.webp"
						alt="Sad monkey with empty wallet and banana"
						className="w-full h-auto object-contain"
					/>
				</div>

				{/* C) Primary message */}
				<p className="text-base font-display font-semibold text-foreground mb-2">
					No tokens yet
				</p>

				{/* D) Secondary message */}
				<p className="text-sm text-muted-foreground mb-8 max-w-[240px]">
					Deposit USDC and swap to buy your first token
				</p>

				{/* E) CTA button - gradient yellow → orange, pill, strong shadow */}
				<Button
					type="button"
					variant="default"
					size="sm"
					onClick={onBuyNow}
					className="btn-gradient-shine rounded-full font-display font-bold uppercase min-w-[140px] tap-scale !bg-gradient-to-r !from-[#FFC700] !to-[#FFA500] hover:!from-[#FFD000] hover:!to-[#FFB020] !text-[#0A0A0A] !border-0 !shadow-[0_4px_14px_rgba(255,199,0,0.4)] hover:!shadow-[0_6px_20px_rgba(255,199,0,0.5)] focus-visible:!ring-2 focus-visible:!ring-[#FFC700] focus-visible:!ring-offset-2"
				>
					Buy now
				</Button>
			</div>
		</div>
	)
}
