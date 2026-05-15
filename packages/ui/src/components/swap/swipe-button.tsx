import { useState, useRef, useCallback } from 'react'
import { ChevronRight } from 'lucide-react'
import { fireEmojiConfetti } from '@/hooks/use-emoji-confetti'

type ActionButtonProps = {
	label: string
	disabled?: boolean
	onClick: () => void
	showConfetti?: boolean
}

const THUMB_SIZE = 64
const TRACK_INSET = 16

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
		<button
			type="button"
			onClick={handleClick}
			disabled={disabled}
			className={`relative flex items-center justify-center rounded-full h-16 min-h-[64px] w-full transition-all select-none border-0 outline-none ${
				disabled
					? 'bg-muted cursor-not-allowed'
					: 'bg-[#FFF1BF] hover:bg-[#FFD680] active:scale-[0.98] tap-scale swipe-ready'
			}`}
		>
			<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
				<span className={`text-sm font-display font-bold uppercase tracking-wide ${disabled ? 'text-muted-foreground/40' : 'text-[#0A0A0A]'}`}>
					{label}
				</span>
			</div>

			<div
				className={`absolute left-[${TRACK_INSET}px] top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full w-16 h-16 ${
					disabled
						? 'bg-muted-foreground/20'
						: '!bg-gradient-to-r !from-[#FFC700] !to-[#FFA500] !shadow-[0_4px_14px_rgba(255,199,0,0.4)] group-hover:!shadow-[0_6px_20px_rgba(255,199,0,0.5)]'
				}`}
			>
				<span className={`flex items-center justify-center ml-[3px] ${disabled ? 'text-muted-foreground/40' : 'text-[#0A0A0A]'}`}>
					<ChevronRight className="w-8 h-8 shrink-0" />
					<ChevronRight className="w-10 h-10 shrink-0 -ml-[27px]" />
				</span>
			</div>
		</button>
	)
}
