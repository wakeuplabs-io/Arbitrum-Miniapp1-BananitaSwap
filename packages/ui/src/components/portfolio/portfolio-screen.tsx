import { DollarSign, ArrowLeftRight, ArrowDownToLine, Copy, Check } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TokenIcon } from '@/components/swap/token-icon'
import { TokensEmptyState } from './tokens-empty-state'
import { usePortfolioChain } from '@/contexts/portfolio-chain-context'
import { useUserHoldings } from '@/hooks/use-user-holdings'
import { useAvatar } from '@/hooks/use-avatar'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
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
	const { portfolioChain } = usePortfolioChain()
	const { nonUsdcHoldings, totalBalanceUsd: balanceUsd, dailyChangePercent, isLoading } =
		useUserHoldings(portfolioChain)
	const avatarUrl = useAvatar()
	const { wallet, isAuthenticated, isInLemonWebView, isAuthenticating, authLogs, clearAuthLogs } = useLemonMiniapp()
	const [copied, setCopied] = useState(false)

	const handleCopyAddress = async () => {
		if (!wallet) return
		
		try {
			await navigator.clipboard.writeText(wallet)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch (error) {
			console.error('Failed to copy address:', error)
		}
	}

	const formatAddress = (address: string) => {
		if (address.length <= 10) return address
		return `${address.slice(0, 6)}...${address.slice(-4)}`
	}

	const actions = [
		{ icon: DollarSign, label: 'Deposit', onClick: onOpenDeposit },
		{ icon: ArrowLeftRight, label: 'Swap', onClick: onOpenSwap },
		{ icon: ArrowDownToLine, label: 'Withdraw', onClick: onOpenWithdraw },
	]


	return (
		<div className="flex flex-col h-full overflow-y-auto pb-20">
			<div className="flex flex-col items-center gap-3 pt-8 pb-4 animate-fade-in-up">
				{avatarUrl && (
					<div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-accent shadow-lg shadow-primary/40">
						<img
							src={avatarUrl}
							alt=""
							className="h-full w-full rounded-full object-cover"
						/>
					</div>
				)}
				{wallet && (
					<div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border">
						<span className="text-xs font-mono text-muted-foreground">
							{formatAddress(wallet)}
						</span>
						<Button
							type="button"
							variant="ghost"
							size="xs"
							onClick={handleCopyAddress}
							className="h-6 w-6 p-0 rounded-full hover:bg-muted"
							aria-label="Copy wallet address"
						>
							{copied ? (
								<Check className="w-3 h-3 text-success" />
							) : (
								<Copy className="w-3 h-3 text-muted-foreground" />
							)}
						</Button>
					</div>
				)}
				<div className="flex flex-col items-center gap-0.5">
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
							className="mt-1 rounded-full !bg-black hover:!bg-gray-900 !text-white !border-0 focus-visible:!ring-2 focus-visible:!ring-white focus-visible:!ring-offset-2"
						>
							Deposit to get started
						</Button>
					) : (
						<p className="flex items-center gap-1 text-sm text-muted-foreground">
							<span
								className={
									dailyChangePercent >= 0 ? 'text-success' : 'text-destructive'
								}
							>
								{dailyChangePercent >= 0 ? '▲' : '▼'}
							</span>
							{`${Math.abs(dailyChangePercent).toFixed(1)}% 24h`}
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

			<div className="px-4 space-y-3">
				<h3 className="text-xs font-display font-semibold uppercase tracking-wide text-muted-foreground">
					LemonMiniapp context
				</h3>
				<div className="grid gap-2">
					<div className="flex flex-col gap-1">
						<label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">wallet</label>
						<input
							readOnly
							value={wallet ?? '—'}
							className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-mono text-foreground"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">isAuthenticated</label>
						<input
							readOnly
							value={String(isAuthenticated)}
							className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-mono text-foreground"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">isInLemonWebView</label>
						<input
							readOnly
							value={String(isInLemonWebView)}
							className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-mono text-foreground"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">isAuthenticating</label>
						<input
							readOnly
							value={String(isAuthenticating)}
							className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-mono text-foreground"
						/>
					</div>
				</div>
				<div className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Auth flow logs</label>
						{authLogs.length > 0 && (
							<Button
								type="button"
								variant="ghost"
								size="xs"
								onClick={clearAuthLogs}
								className="h-6 text-[10px]"
							>
								Clear
							</Button>
						)}
					</div>
					<div className="rounded-lg border border-border bg-muted/50 px-3 py-2 max-h-40 overflow-y-auto font-mono text-[10px] text-foreground space-y-1">
						{authLogs.length === 0 ? (
							<span className="text-muted-foreground">No logs yet.</span>
						) : (
							authLogs.map((entry) => (
								<div key={entry.id} className="flex gap-2 flex-wrap">
									<span className="text-muted-foreground shrink-0">{entry.time}</span>
									<span>{entry.message}</span>
								</div>
							))
						)}
					</div>
				</div>
			</div>

			<div className="px-4 pt-4 flex-1">
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
