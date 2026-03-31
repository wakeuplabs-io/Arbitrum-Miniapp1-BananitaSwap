import { useState, useRef, useCallback } from 'react'
import { ChevronRight } from 'lucide-react'
import { fireEmojiConfetti } from '@/hooks/use-emoji-confetti'

type SwipeButtonProps = {
	label: string
	disabled?: boolean
	onSwipeComplete: () => void
	showConfetti?: boolean
}

const THRESHOLD_RATIO = 0.6
const THUMB_SIZE = 64
const TRACK_INSET = 16
const EDGE_BACK_GESTURE_GUARD_PX = 28

export function SwipeButton({
	label,
	disabled = false,
	onSwipeComplete,
	showConfetti = true,
}: SwipeButtonProps) {
	const [dragX, setDragX] = useState(0)
	const [isDragging, setIsDragging] = useState(false)
	const [completed, setCompleted] = useState(false)
	const [isResetting, setIsResetting] = useState(false)
	const trackRef = useRef<HTMLDivElement>(null)
	const startXRef = useRef(0)

	const getMaxDrag = useCallback(() => {
		if (!trackRef.current) return 200
		return Math.max(0, trackRef.current.offsetWidth - THUMB_SIZE - TRACK_INSET * 2)
	}, [])

	const handleStart = useCallback(
		(clientX: number) => {
			if (disabled || completed) return
			const trackRect = trackRef.current?.getBoundingClientRect()
			if (trackRect && clientX < trackRect.left + EDGE_BACK_GESTURE_GUARD_PX) {
				// Avoid initiating swipe in the OS back-gesture zone.
				return
			}
			setIsDragging(true)
			setIsResetting(false)
			startXRef.current = clientX - dragX
		},
		[disabled, completed, dragX]
	)

	const handleMove = useCallback(
		(clientX: number) => {
			if (!isDragging || disabled) return
			const maxDrag = getMaxDrag()
			const newX = Math.max(0, Math.min(clientX - startXRef.current, maxDrag))
			setDragX(newX)
		},
		[isDragging, disabled, getMaxDrag]
	)

	const handleEnd = useCallback(() => {
		if (!isDragging) return
		setIsDragging(false)
		const maxDrag = getMaxDrag()
		if (dragX > maxDrag * THRESHOLD_RATIO) {
			setDragX(maxDrag)
			setCompleted(true)
			if (showConfetti) {
				fireEmojiConfetti()
			}
			onSwipeComplete()
			setIsResetting(true)
			setTimeout(() => {
				setDragX(0)
				setCompleted(false)
				setIsResetting(false)
			}, 800)
		} else {
			setIsResetting(true)
			setDragX(0)
			setTimeout(() => setIsResetting(false), 300)
		}
	}, [isDragging, dragX, getMaxDrag, onSwipeComplete, showConfetti])

	return (
		<div
			ref={trackRef}
			role="button"
			tabIndex={disabled ? -1 : 0}
			aria-label={label}
			aria-disabled={disabled}
			className={`relative flex items-center rounded-full h-16 min-h-[64px] transition-colors select-none overflow-hidden ${disabled
					? 'bg-muted cursor-not-allowed border-0 outline-none'
					: 'bg-[#FFF1BF] cursor-grab border-0 outline-none active:cursor-grabbing swipe-ready'
				}`}
			style={{ touchAction: 'pan-y' }}
			onMouseMove={(e) => handleMove(e.clientX)}
			onMouseUp={handleEnd}
			onMouseLeave={handleEnd}
			onTouchMove={(e) => {
				if (!disabled && e.cancelable) {
					e.preventDefault()
				}
				handleMove(e.touches[0].clientX)
			}}
			onTouchEnd={handleEnd}
		>
			{/* Subtle yellow progress fill during swipe (opacity 0.3) */}
			{!disabled && (
				<div
					className="absolute inset-y-0 left-0 rounded-l-full transition-[width] duration-150 ease-out"
					style={{
						width: `calc(${TRACK_INSET + THUMB_SIZE / 2}px + ${dragX}px)`,
						backgroundColor: 'rgba(255, 199, 0, 0.35)',
					}}
				/>
			)}

			<div
				className={`absolute inset-0 flex items-center justify-center pointer-events-none ${disabled ? 'text-muted-foreground/40' : 'text-[#0A0A0A]'
					}`}
			>
				<span className="text-sm font-display font-bold uppercase tracking-wide">
					{label}
				</span>
			</div>

			<div
				className={`absolute top-1/2 ${!isDragging && !isResetting ? 'transition-transform duration-300 ease-out' : ''}`}
				style={{
					width: THUMB_SIZE,
					height: THUMB_SIZE,
					left: TRACK_INSET,
					transform: `translate3d(${dragX}px, -50%, 0)`,
					touchAction: 'pan-y',
				}}
				onMouseDown={(e) => handleStart(e.clientX)}
				onTouchStart={(e) => {
					if (!disabled && e.cancelable) {
						e.preventDefault()
					}
					handleStart(e.touches[0].clientX)
				}}
			>
				<div
					className={`flex items-center justify-center rounded-full border-0 w-full h-full ${disabled
							? 'bg-muted-foreground/20'
							: '!bg-gradient-to-r !from-[#FFC700] !to-[#FFA500] !shadow-[0_4px_14px_rgba(255,199,0,0.4)]'
						} ${!disabled && !isDragging && !isResetting && !completed ? 'swipe-thumb-hint' : ''}`}
				>
					<span
						className={`flex items-center justify-center ml-[3px] ${disabled ? 'text-muted-foreground/40' : 'text-[#0A0A0A]'
							}`}
					>
						<ChevronRight className="w-8 h-8 shrink-0" />
						<ChevronRight className="w-10 h-10 shrink-0 -ml-[27px]" />
					</span>
				</div>
			</div>
		</div>
	)
}
