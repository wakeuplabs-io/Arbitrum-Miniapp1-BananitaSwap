import { Button } from '@/components/ui/button'
import { useAvatar } from '@/hooks/use-avatar'

type PortfolioHeaderProps = {
	lemonTag?: string | undefined
	balanceUsd: number
	dailyChangePercent: number
	isLoading?: boolean
	onOpenDeposit: () => void
}

export function PortfolioHeader({
	lemonTag,
	balanceUsd,
	dailyChangePercent,
	isLoading,
	onOpenDeposit,
}: PortfolioHeaderProps) {
	const avatarUrl = useAvatar()

	return (
		<div className="flex flex-col items-center gap-3 pt-8 pb-4 animate-fade-in-up">
			<div className="flex h-20 w-20 items-center justify-center rounded-full overflow-hidden bg-card border border-border">
				{avatarUrl ? (
					<img src={avatarUrl} alt="" className="h-full w-full object-cover" />
				) : (
					<div className="h-full w-full bg-muted animate-pulse" />
				)}
			</div>
			{lemonTag && (
				<span className="text-xs text-muted-foreground">@{lemonTag}</span>
			)}
			<div className="flex flex-col items-center gap-0.5">
				<p className="text-xs font-display font-medium tracking-wide uppercase text-muted-foreground">
					Total value in USDC
				</p>
				{isLoading ? (
					<>
						<div className="h-12 w-32 bg-muted rounded animate-pulse" aria-hidden />
						<div className="h-4 w-20 bg-muted rounded animate-pulse mt-2" aria-hidden />
					</>
				) : (
					<>
						<p className="text-5xl text-foreground tracking-tight numeric-balance">${balanceUsd.toFixed(2)}</p>
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
								<span className={dailyChangePercent >= 0 ? 'text-success' : 'text-destructive'}>
									{dailyChangePercent >= 0 ? '▲' : '▼'}
								</span>
								{`${Math.abs(dailyChangePercent).toFixed(1)}% 24h`}
							</p>
						)}
					</>
				)}
			</div>
		</div>
	)
}
