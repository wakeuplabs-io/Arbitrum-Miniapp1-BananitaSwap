import { useState, useRef, useCallback } from 'react'
import { DollarSign, ArrowLeftRight, ArrowDownToLine, X, Pencil } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TokenIcon } from '@/components/swap/token-icon'
import { TokensEmptyState } from './tokens-empty-state'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useUserHoldings } from '@/hooks/use-user-holdings'
import type { Token } from '@/lib/tokens'

type PortfolioScreenProps = {
	onOpenDeposit: () => void
	onOpenWithdraw: () => void
	onOpenSwap: () => void
	onSellToken: (token: Token) => void
	onBuyToken: (token: Token) => void
}

export function PortfolioScreen({
	onOpenDeposit,
	onOpenWithdraw,
	onOpenSwap,
	onSellToken,
	onBuyToken,
}: PortfolioScreenProps) {
	const navigate = useNavigate()
	const { nonUsdcHoldings, totalBalanceUsd: balanceUsd, isLoading } = useUserHoldings()
	const profile = useUserProfile()

	const changePercent = 0 // TODO: Calculate from historical data if needed
	const [isEditingName, setIsEditingName] = useState(false)
	const [draftName, setDraftName] = useState(profile.displayName)
	const [avatarError, setAvatarError] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const actions = [
		{ icon: DollarSign, label: 'Deposit', onClick: onOpenDeposit },
		{ icon: ArrowLeftRight, label: 'Swap', onClick: onOpenSwap },
		{ icon: ArrowDownToLine, label: 'Withdraw', onClick: onOpenWithdraw },
	]

	const handleSaveName = useCallback(() => {
		profile.setDisplayName(draftName)
		setIsEditingName(false)
	}, [draftName, profile])

	const handleNameKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter') handleSaveName()
		},
		[handleSaveName]
	)

	const handleAvatarClick = useCallback(() => {
		setAvatarError(null)
		fileInputRef.current?.click()
	}, [])

	const handleAvatarFileChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0]
			e.target.value = ''
			if (!file) return
			const result = await profile.setAvatarFromFile(file)
			if (result.success) {
				setAvatarError(null)
			} else {
				setAvatarError(result.error ?? 'Error uploading image')
			}
		},
		[profile]
	)

	const handleRemoveAvatar = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			profile.clearAvatar()
			setAvatarError(null)
		},
		[profile]
	)

	return (
		<div className="flex flex-col h-full overflow-y-auto pb-20">
			<div className="flex flex-col items-center gap-3 pt-8 pb-4 animate-fade-in-up">
				<div className="relative">
					<button
						type="button"
						onClick={handleAvatarClick}
						aria-label="Change profile photo"
						className={`avatar-interactive flex h-20 w-20 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-shadow ${profile.avatarDataUrl
							? 'bg-gradient-to-tr from-primary to-accent shadow-lg shadow-primary/40'
							: 'bg-card'
							}`}
					>
						<div className={`flex items-center justify-center rounded-full overflow-hidden ${profile.avatarDataUrl
							? 'h-[4.25rem] w-[4.25rem] border border-border bg-card'
							: 'h-full w-full'
							}`}>
							{profile.avatarDataUrl ? (
								<img
									src={profile.avatarDataUrl}
									alt=""
									className="h-full w-full object-cover"
								/>
							) : (
								<img
									src="/avatar-empty-state.webp"
									alt=""
									className="h-full w-full object-cover object-center scale-110"
								/>
							)}
						</div>
					</button>
					<button
						type="button"
						onClick={handleAvatarClick}
						aria-label="Change profile photo"
						className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
					>
						<Pencil className="h-3 w-3" strokeWidth={2.5} />
					</button>
					{profile.avatarDataUrl && (
						<button
							type="button"
							onClick={handleRemoveAvatar}
							aria-label="Remove profile photo"
							className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
						>
							<X className="h-3.5 w-3.5" strokeWidth={2.5} />
						</button>
					)}
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						className="sr-only"
						aria-hidden
						onChange={handleAvatarFileChange}
					/>
				</div>
				{avatarError && (
					<p className="text-xs text-destructive text-center max-w-[240px]">
						{avatarError}
					</p>
				)}
				{isEditingName ? (
					<div className="flex flex-col items-center gap-2 w-full max-w-[200px]">
						<Input
							type="text"
							value={draftName.startsWith('@') ? draftName.slice(1) : draftName}
							onChange={(e) => setDraftName(e.target.value.replace(/^@+/, ''))}
							onKeyDown={handleNameKeyDown}
							placeholder="name"
							className="text-center text-xs font-mono"
							autoFocus
						/>
						<Button
							type="button"
							variant="outline"
							size="xs"
							onClick={handleSaveName}
							className="rounded-full"
						>
							Save
						</Button>
					</div>
				) : (
					<button
						type="button"
						onClick={() => {
							setDraftName(profile.displayName)
							setIsEditingName(true)
						}}
						className="text-xs font-mono text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
					>
						{profile.displayNameFormatted}
					</button>
				)}
				<div className="flex flex-col items-center gap-0.5 mt-2">
					<p className="text-xs font-display font-medium tracking-wide uppercase text-muted-foreground">
						Total value in USDC
					</p>
					<p className="text-5xl text-foreground tracking-tight numeric-balance">
						${balanceUsd.toFixed(2)}
					</p>
					{balanceUsd === 0 ? (
						<Button
							type="button"
							variant="default"
							size="xs"
							onClick={onOpenDeposit}
							className="mt-1 rounded-full !bg-gradient-to-r !from-[#FFC700] !to-[#FFA500] hover:!from-[#FFD000] hover:!to-[#FFB020] !text-[#0A0A0A] !border-0 !shadow-[0_4px_14px_rgba(255,199,0,0.4)] hover:!shadow-[0_6px_20px_rgba(255,199,0,0.5)] focus-visible:!ring-2 focus-visible:!ring-[#FFC700] focus-visible:!ring-offset-2"
						>
							Deposit to get started
						</Button>
					) : (
						<p className="flex items-center gap-1 text-sm text-muted-foreground">
							<span
								className={
									changePercent >= 0 ? 'text-success' : 'text-destructive'
								}
							>
								{changePercent >= 0 ? '▲' : '▼'}
							</span>
							{`${Math.abs(changePercent).toFixed(1)}% All time`}
						</p>
					)}
				</div>
			</div>

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

			<div className="h-0.5 bg-border m-4" />

			<div className="px-4 pt-0 flex-1">
				<h2 className="text-base sm:text-lg font-display font-bold uppercase tracking-wide text-foreground mb-8">
					Your Tokens
				</h2>

				{isLoading ? (
					<div className="flex flex-col gap-4">
						{Array.from({ length: 3 }).map((_, index) => (
							<div
								key={index}
								className="flex items-center gap-4 py-4 px-4 rounded-3xl bg-card border-2 border-border w-full animate-pulse"
							>
								<div className="w-10 h-10 rounded-full bg-muted shrink-0" />
								<div className="flex flex-col min-w-0 flex-1 gap-2">
									<div className="h-4 w-24 bg-muted rounded" />
									<div className="h-3 w-16 bg-muted rounded" />
								</div>
								<div className="flex flex-col items-end shrink-0 mr-1 gap-2">
									<div className="h-4 w-20 bg-muted rounded" />
									<div className="h-3 w-16 bg-muted rounded" />
								</div>
								<div className="flex flex-col gap-1.5 shrink-0">
									<div className="h-8 w-16 bg-muted rounded-full" />
									<div className="h-8 w-16 bg-muted rounded-full" />
								</div>
							</div>
						))}
					</div>
				) : nonUsdcHoldings.length === 0 ? (
					<TokensEmptyState onBuyNow={onOpenSwap} />
				) : (
					<div>
						<div className="flex flex-col gap-4 stagger-slide-up">
							{nonUsdcHoldings.map((holding) => {
								const usdValue = holding.amount * holding.token.price
								return (
									<div
										key={holding.token.symbol}
										role="button"
										tabIndex={0}
										onClick={() =>
											navigate({
												to: '/swap',
												search: {
													token: holding.token.symbol,
													mode: 'buy'
												}
											})
										}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault()
												navigate({
													to: '/swap',
													search: {
														token: holding.token.symbol,
														mode: 'buy'
													}
												})
											}
										}}
										className="flex items-center gap-4 py-4 px-4 rounded-3xl bg-card border-2 border-border w-full text-left cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring tap-scale transition-transform"
									>
										<TokenIcon
											symbol={holding.token.symbol}
											color={holding.token.color}
											logoUrl={holding.token.logoUrl}
											size={40}
										/>

										<div className="flex flex-col min-w-0 flex-1 gap-1">
											<span className="text-sm font-display font-semibold text-foreground truncate">
												{holding.token.name}
											</span>
											<span className="text-xs numeric text-muted-foreground">
												{holding.amount} {holding.token.symbol}
											</span>
										</div>

										<div className="flex flex-col items-end shrink-0 mr-1 gap-1">
											<span className="text-sm numeric font-bold text-foreground text-price">
												${usdValue < 0.01 ? '<0.01' : usdValue.toFixed(2)}
											</span>
											<span
												className={`text-xs numeric ${holding.token.change24h >= 0
													? 'text-success'
													: 'text-destructive'
													}`}
											>
												{holding.token.change24h >= 0 ? '+' : ''}
												{holding.token.change24h.toFixed(3)}%
											</span>
										</div>

										<div className="flex flex-col gap-1.5 shrink-0">
											<Button
												type="button"
												variant="success"
												size="xs"
												onClick={(e) => {
													e.stopPropagation()
													onBuyToken(holding.token)
												}}
												className="rounded-full min-h-[32px]"
											>
												Buy
											</Button>
											<Button
												type="button"
												variant="destructive"
												size="xs"
												onClick={(e) => {
													e.stopPropagation()
													onSellToken(holding.token)
												}}
												className="rounded-full min-h-[32px]"
											>
												Sell
											</Button>
										</div>
									</div>
								)
							})}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
