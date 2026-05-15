import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { fireEmojiConfetti } from '@/hooks/use-emoji-confetti'
import { cn } from '@/lib/utils'

type ActionButtonProps = {
	label: string
	disabled?: boolean
	onClick: () => void
	showConfetti?: boolean
}

const gradientEnabledClass =
	'btn-gradient-shine tap-scale !bg-gradient-to-r !from-[#FFC700] !to-[#FFA500] hover:!from-[#FFD000] hover:!to-[#FFB020] !text-[#0A0A0A] !border-0 !shadow-[0_4px_14px_rgba(255,199,0,0.4)] hover:!shadow-[0_6px_20px_rgba(255,199,0,0.5)] focus-visible:!ring-2 focus-visible:!ring-[#FFC700] focus-visible:!ring-offset-2'

export function ActionButton({
	label,
	disabled = false,
	onClick,
	showConfetti = true,
}: ActionButtonProps) {
	const [isPressed, setIsPressed] = useState(false)
	const pressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const handleClick = useCallback(() => {
		if (disabled || isPressed) return

		setIsPressed(true)
		if (showConfetti) {
			fireEmojiConfetti()
		}
		onClick()

		pressTimeoutRef.current = setTimeout(() => {
			setIsPressed(false)
		}, 500)
	}, [disabled, isPressed, onClick, showConfetti])

	return (
		<Button
			type="button"
			variant="default"
			size="xl"
			onClick={handleClick}
			disabled={disabled}
			className={cn(
				'h-16 min-h-[64px] w-full max-w-none rounded-full border-0 px-4 text-sm hover:!scale-[1.01] active:!scale-[0.98]',
				disabled
					? '!bg-muted !text-muted-foreground !shadow-none hover:!scale-100 disabled:!opacity-100'
					: gradientEnabledClass,
			)}
		>
			{label}
		</Button>
	)
}
