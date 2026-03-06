import { useState, useCallback, useEffect, useRef } from 'react'
import { ArrowUpDown, ChevronDown } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { TokenIcon } from './token-icon'
import { SwipeButton } from './swipe-button'
import { DexScreenerEmbedChart } from './dexscreener-embed-chart'
import type { Token } from '@/lib/tokens'
import { getUsdcToken } from '@/hooks/use-tokens'
import { useMockTokenState } from '@/contexts/mock-token-state'
import { useUserHoldings } from '@/hooks/use-user-holdings'


type SwapScreenProps = {
	onOpenTokenSelect: (side: 'sell' | 'buy') => void
	buyToken: Token | null
	sellToken: Token | null
	direction: 'buy' | 'sell'
	onToggleDirection: () => void
	onSwapComplete: () => void
}

export function SwapScreen({
	onOpenTokenSelect,
	buyToken,
	sellToken,
	direction,
	onToggleDirection,
	onSwapComplete,
}: SwapScreenProps) {
	const navigate = useNavigate()
	const usdc = getUsdcToken()
	const { getUsdcBalance, getTokenBalance } = useUserHoldings('mainnet')
	const { isMocking, swap: mockSwap } = useMockTokenState()
	const [amount, setAmount] = useState('')
	const [isFocused, setIsFocused] = useState(false)
	const [selectedPercent, setSelectedPercent] = useState<number | null>(null)
	const [isDirectionBtnPressed, setIsDirectionBtnPressed] = useState(false)
	const [isProcessing, setIsProcessing] = useState(false)
	const directionBtnPressedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const topToken = direction === 'buy' ? usdc : sellToken
	const bottomToken = direction === 'buy' ? buyToken : usdc
	const pairToken = direction === 'buy' ? buyToken : sellToken

	// Get USDC balance only
	const usdcBalance = getUsdcBalance()

	// Get balance from mock holdings if available, otherwise use token balance
	const topBalance = topToken
		? getTokenBalance(topToken.symbol, topToken.balance)
		: 0
	const amountValue = parseFloat(amount) || 0

	const outputValue =
		topToken && bottomToken && amountValue > 0
			? (amountValue * topToken.price) / bottomToken.price
			: 0

	const exceeds = amountValue > topBalance
	const isValid =
		amountValue > 0 && !exceeds && topToken !== null && bottomToken !== null

	useEffect(() => {
		setAmount('')
		setSelectedPercent(null)
	}, [direction, sellToken, buyToken])

	useEffect(() => {
		return () => {
			if (directionBtnPressedTimeoutRef.current) {
				clearTimeout(directionBtnPressedTimeoutRef.current)
			}
		}
	}, [])

	const handlePercent = useCallback(
		(pct: number) => {
			const val = (topBalance * pct) / 100
			setAmount(val > 0 ? val.toString() : '')
			setSelectedPercent(pct)
		},
		[topBalance]
	)

	function formatOutputAmount(val: number) {
		if (val === 0) return '0'
		if (val < 0.0001) return val.toFixed(8)
		if (val < 1) return val.toFixed(6)
		return val.toFixed(4)
	}

	function formatFiat(val: number) {
		if (val === 0) return '0 US$'
		if (val < 0.01) return '<0.01 US$'
		return `${val.toFixed(2)} US$`
	}

	const topLabel = direction === 'buy' ? 'Sell' : 'Sell'
	const bottomLabel = direction === 'buy' ? 'Buy' : 'Buy'
	const swipeLabel = direction === 'buy' ? 'Swipe to Buy' : 'Swipe to Sell'
	const nonFixedSide = direction === 'buy' ? 'buy' : 'sell'

	function handleToggleDirection() {
		onToggleDirection()
		scheduleDirectionBtnReset()
	}

	function handleDirectionBtnPointerDown() {
		if (directionBtnPressedTimeoutRef.current) {
			clearTimeout(directionBtnPressedTimeoutRef.current)
			directionBtnPressedTimeoutRef.current = null
		}
		setIsDirectionBtnPressed(true)
	}

	function handleDirectionBtnPointerUp() {
		scheduleDirectionBtnReset()
	}

	function handleDirectionBtnPointerLeave() {
		if (directionBtnPressedTimeoutRef.current) {
			clearTimeout(directionBtnPressedTimeoutRef.current)
			directionBtnPressedTimeoutRef.current = null
		}
		setIsDirectionBtnPressed(false)
	}

	const scheduleDirectionBtnReset = useCallback(() => {
		if (directionBtnPressedTimeoutRef.current) {
			clearTimeout(directionBtnPressedTimeoutRef.current)
		}
		directionBtnPressedTimeoutRef.current = setTimeout(() => {
			setIsDirectionBtnPressed(false)
			directionBtnPressedTimeoutRef.current = null
		}, 500)
	}, [])

	useEffect(() => {
		if (!isDirectionBtnPressed) return

		function handleRelease() {
			scheduleDirectionBtnReset()
		}

		document.addEventListener('pointerup', handleRelease, { capture: true })
		document.addEventListener('touchend', handleRelease, { capture: true, passive: true })
		return () => {
			document.removeEventListener('pointerup', handleRelease, { capture: true })
			document.removeEventListener('touchend', handleRelease, { capture: true })
		}
	}, [isDirectionBtnPressed, scheduleDirectionBtnReset])

	return (
		<div className="flex flex-col h-full bg-[#FFFFFF]">
			<div className="flex-1 overflow-y-auto overflow-x-hidden pb-20 w-full min-w-0">
				<div className="flex flex-col items-center w-full min-w-0 pt-6 pb-8 animate-fade-in-up">
					<p className="text-xs font-display font-medium tracking-wide uppercase text-muted-foreground">
						Available USDC
					</p>
					<p className="text-5xl text-foreground mt-1 tracking-tight numeric-balance">
						${usdcBalance.toFixed(2)}
					</p>
					{usdcBalance === 0 && (
						<Button
							type="button"
							variant="default"
							size="xs"
							onClick={() => {
								navigate({
									to: '/portfolio',
									search: { action: 'deposit' },
								})
							}}
							className="mt-1 rounded-full !bg-black hover:!bg-gray-900 !text-white !border-0 focus-visible:!ring-2 focus-visible:!ring-white focus-visible:!ring-offset-2"
						>
							Deposit to get started
						</Button>
					)}
				</div>

				<div className="px-4 w-full max-w-full box-border">
					<div className="bg-card rounded-2xl border-2 border-border p-4 shadow-sm hover:border-primary hover:shadow-xl card-lift tap-scale w-full max-w-full box-border">
						<div className="flex items-center justify-between mb-4">
							<span className="text-xs font-display font-bold tracking-wide uppercase text-muted-foreground">
								{topLabel}
							</span>
							<div className="flex items-center gap-2">
								{[25, 50].map((pct) => {
									const isSelected = selectedPercent === pct
									return (
										<Button
											key={pct}
											type="button"
											variant="outline"
											size="xs"
											onClick={() => handlePercent(pct)}
											className={`btn-percent shrink-0 rounded-xl border-2 border-transparent ${isSelected
												? 'bg-[#0A0A0A] text-white hover:bg-[#0A0A0A] hover:text-white focus-visible:bg-[#0A0A0A] focus-visible:text-white'
												: 'bg-[#F5F5F5] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white focus-visible:bg-[#0A0A0A] focus-visible:text-white'
												}`}
										>
											{pct}%
										</Button>
									)
								})}
								<Button
									type="button"
									variant="outline"
									size="xs"
									onClick={() => handlePercent(100)}
									className={`btn-percent shrink-0 rounded-xl border-2 border-transparent ${selectedPercent === 100
										? 'bg-[#0A0A0A] text-white hover:bg-[#0A0A0A] hover:text-white focus-visible:bg-[#0A0A0A] focus-visible:text-white'
										: 'bg-[#F5F5F5] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white focus-visible:bg-[#0A0A0A] focus-visible:text-white'
										}`}
								>
									Max
								</Button>
							</div>
						</div>

						<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
							<input
								type="text"
								inputMode="decimal"
								value={amount}
								onChange={(e) => {
									const v = e.target.value.replace(/[^0-9.,]/g, '')
									if (v.split('.').length <= 2 && v.split(',').length <= 2) {
										setAmount(v)
										setSelectedPercent(null)
									}
								}}
								onFocus={() => setIsFocused(true)}
								onBlur={() => setIsFocused(false)}
								placeholder="0"
								aria-label={topLabel === 'Sell' ? 'Amount to sell' : 'Amount to sell'}
								className={`bg-transparent numeric font-bold text-foreground outline-none w-full min-w-0 placeholder:text-muted-foreground/50 rounded-xl focus:ring-0 focus:ring-offset-0 text-[clamp(1.25rem,5vw,1.875rem)] ${isFocused ? 'caret-primary' : ''
									}`}
							/>

							{topToken ? (
								topToken.symbol === 'USDC' ? (
									<div
										className="shrink-0 flex items-center gap-2 rounded-full px-3 py-2 bg-[#FFF1BF] text-[#0A0A0A] text-sm font-display font-bold uppercase tracking-wide border-0 outline-none ring-0 shadow-none"
										aria-label="USDC (fixed)"
									>
										<TokenIcon
											symbol={topToken.symbol}
											color={topToken.color}
											logoUrl={topToken.logoUrl}
											size={28}
										/>
										<span>{topToken.symbol}</span>
									</div>
								) : (
									<Button
										type="button"
										variant="secondary"
										size="sm"
										onClick={() => onOpenTokenSelect('sell')}
										className="btn-gradient-shine shrink-0 gap-2 rounded-full !bg-gradient-to-r !from-[#FFC700] !to-[#FFA500] hover:!from-[#FFD000] hover:!to-[#FFB020] !text-[#0A0A0A] !border-0 !shadow-[0_4px_14px_rgba(255,199,0,0.4)] hover:!shadow-[0_6px_20px_rgba(255,199,0,0.5)] focus-visible:!from-[#FFC700] focus-visible:!to-[#FFA500] focus-visible:!ring-2 focus-visible:!ring-[#FFC700] focus-visible:!ring-offset-2"
									>
										<TokenIcon
											symbol={topToken.symbol}
											color={topToken.color}
											logoUrl={topToken.logoUrl}
											size={28}
										/>
										<span>{topToken.symbol}</span>
										<ChevronDown className="w-4 h-4 text-[#0A0A0A]" />
									</Button>
								)
							) : (
								<Button
									type="button"
									variant="default"
									size="sm"
									onClick={() => onOpenTokenSelect('sell')}
									className="btn-gradient-shine shrink-0 gap-1 rounded-full !bg-gradient-to-r !from-[#FFC700] !to-[#FFA500] hover:!from-[#FFD000] hover:!to-[#FFB020] !text-[#0A0A0A] !border-0 !shadow-[0_4px_14px_rgba(255,199,0,0.4)] hover:!shadow-[0_6px_20px_rgba(255,199,0,0.5)] focus-visible:!from-[#FFC700] focus-visible:!to-[#FFA500] focus-visible:!ring-2 focus-visible:!ring-[#FFC700] focus-visible:!ring-offset-2"
								>
									Select token
									<ChevronDown className="w-4 h-4 text-[#0A0A0A]" />
								</Button>
							)}
						</div>

						<div className="flex items-center justify-between mt-2">
							<span
								className={`text-xs numeric ${exceeds ? 'text-destructive font-medium' : 'text-muted-foreground'
									}`}
							>
								{exceeds
									? 'Exceeds balance'
									: formatFiat(amountValue * (topToken?.price ?? 0))}
							</span>
							<span className="text-xs numeric text-muted-foreground">
								{topBalance.toFixed(4)} {topToken?.symbol ?? ''}
							</span>
						</div>
					</div>

					<div className="flex items-center justify-center -my-3 relative z-10">
						<div
							role="button"
							tabIndex={-1}
							onClick={handleToggleDirection}
							onPointerDown={handleDirectionBtnPointerDown}
							onPointerUp={handleDirectionBtnPointerUp}
							onPointerLeave={handleDirectionBtnPointerLeave}
							onTouchStart={handleDirectionBtnPointerDown}
							onTouchEnd={() => handleDirectionBtnPointerUp()}
							onTouchCancel={handleDirectionBtnPointerLeave}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault()
									handleToggleDirection()
								}
							}}
							aria-label="Swap direction"
							className={`swap-direction-btn inline-flex items-center justify-center rounded-full w-12 h-12 border-2 border-border bg-card shadow-sm icon-tap-scale transition-all duration-150 select-none outline-none focus:outline-none focus-visible:outline-none [@media(hover:hover)]:hover:border-[#FFC700] [@media(hover:hover)]:hover:bg-[#FFC700] ${isDirectionBtnPressed ? 'swap-direction-btn-pressed' : ''}`}
						>
							<ArrowUpDown className="w-5 h-5 text-[#0A0A0A]" />
						</div>
					</div>

					<div className="bg-card rounded-2xl border-2 border-border p-4 shadow-sm hover:border-primary hover:shadow-xl card-lift tap-scale w-full max-w-full box-border">
						<span className="text-xs font-display font-bold tracking-wide uppercase text-muted-foreground mb-3 block">
							{bottomLabel}
						</span>

						<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
							<span className="text-[clamp(1.25rem,5vw,1.875rem)] numeric font-bold text-foreground/40 text-price overflow-hidden text-ellipsis whitespace-nowrap min-w-0 block">
								{bottomToken
									? formatOutputAmount(outputValue)
									: '0'}
							</span>

							{bottomToken ? (
								bottomToken.symbol === 'USDC' ? (
									<div
										className="shrink-0 flex items-center gap-2 rounded-full px-3 py-2 bg-[#FFF1BF] text-[#0A0A0A] text-sm font-display font-bold uppercase tracking-wide border-0 outline-none ring-0 shadow-none"
										aria-label="USDC (fixed)"
									>
										<TokenIcon
											symbol={bottomToken.symbol}
											color={bottomToken.color}
											logoUrl={bottomToken.logoUrl}
											size={28}
										/>
										<span className="text-sm font-display font-bold uppercase">
											{bottomToken.symbol}
										</span>
									</div>
								) : (
									<Button
										type="button"
										variant="secondary"
										size="sm"
										onClick={() => onOpenTokenSelect('buy')}
										className="btn-gradient-shine shrink-0 gap-2 rounded-full !bg-gradient-to-r !from-[#FFC700] !to-[#FFA500] hover:!from-[#FFD000] hover:!to-[#FFB020] !text-[#0A0A0A] !border-0 !shadow-[0_4px_14px_rgba(255,199,0,0.4)] hover:!shadow-[0_6px_20px_rgba(255,199,0,0.5)] focus-visible:!from-[#FFC700] focus-visible:!to-[#FFA500] focus-visible:!ring-2 focus-visible:!ring-[#FFC700] focus-visible:!ring-offset-2"
									>
										<TokenIcon
											symbol={bottomToken.symbol}
											color={bottomToken.color}
											logoUrl={bottomToken.logoUrl}
											size={28}
										/>
										<span className="text-sm font-display font-bold uppercase">
											{bottomToken.symbol}
										</span>
										<ChevronDown className="w-4 h-4 text-[#0A0A0A]" />
									</Button>
								)
							) : (
								<Button
									type="button"
									variant="default"
									size="sm"
									onClick={() => onOpenTokenSelect(nonFixedSide)}
									className="btn-gradient-shine shrink-0 gap-1 rounded-full !bg-gradient-to-r !from-[#FFC700] !to-[#FFA500] hover:!from-[#FFD000] hover:!to-[#FFB020] !text-[#0A0A0A] !border-0 !shadow-[0_4px_14px_rgba(255,199,0,0.4)] hover:!shadow-[0_6px_20px_rgba(255,199,0,0.5)] focus-visible:!from-[#FFC700] focus-visible:!to-[#FFA500] focus-visible:!ring-2 focus-visible:!ring-[#FFC700] focus-visible:!ring-offset-2"
								>
									Select token
									<ChevronDown className="w-4 h-4 text-[#0A0A0A]" />
								</Button>
							)}
						</div>

						<div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
							<span className="text-xs numeric text-muted-foreground">
								{bottomToken
									? formatFiat(outputValue * bottomToken.price)
									: '0 US$'}
							</span>
							{bottomToken && amountValue > 0 && (
								<span className="text-xs text-muted-foreground">
									1 {topToken?.symbol} ≈ {formatOutputAmount((topToken?.price ?? 0) / bottomToken.price)} {bottomToken.symbol}
								</span>
							)}
						</div>
					</div>

					{pairToken && (
						<>
							<div className="py-4 rounded-2xl overflow-hidden">
								<DexScreenerEmbedChart token={pairToken} />
							</div>
						</>
					)}
				</div>
			</div>

			<div className="fixed bottom-16 left-0 right-0 px-4 pt-3 pb-4 bg-[#FFFFFF] max-w-[430px] mx-auto z-30">
				<SwipeButton
					label={swipeLabel}
					disabled={!isValid || isProcessing}
					onSwipeComplete={async () => {
						if (isMocking && topToken && bottomToken && amountValue > 0) {
							setIsProcessing(true)
							try {
								await mockSwap(
									topToken.symbol,
									bottomToken.symbol,
									amountValue,
									outputValue,
									bottomToken
								)
								onSwapComplete()
							} catch (err) {
								console.error('Swap error:', err)
								// Error handling could be added here if needed
							} finally {
								setIsProcessing(false)
							}
						} else {
							onSwapComplete()
						}
					}}
				/>
			</div>
		</div>
	)
}
