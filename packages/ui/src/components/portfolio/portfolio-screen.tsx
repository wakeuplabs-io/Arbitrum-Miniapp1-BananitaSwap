import { DollarSign, ArrowLeftRight, ArrowDownToLine } from 'lucide-react'
import { TokensEmptyState } from './portfolio-view/tokens-empty-state'
import { PortfolioHeader } from './portfolio-view/portfolio-header'
import { PortfolioActions } from './portfolio-view/portfolio-actions'
import { TokenListItem } from './portfolio-view/token-list-item'
import { TokenListSkeleton } from './portfolio-view/token-list-skeleton'
import { usePortfolioChain } from '@/contexts/portfolio-chain-context'
import { useUserHoldings } from '@/hooks/use-user-holdings'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
import type { Token } from '@/lib/tokens'

type PortfolioScreenProps = {
	onOpenDeposit: () => void
	onOpenWithdraw: () => void
	onOpenSwap: () => void
	onSellToken: (token: Token) => void
	onBuyToken: (token: Token) => void
}

const ACTIONS = [
	{ icon: DollarSign, label: 'Deposit' },
	{ icon: ArrowLeftRight, label: 'Swap' },
	{ icon: ArrowDownToLine, label: 'Withdraw' },
] as const

export function PortfolioScreen({
	onOpenDeposit,
	onOpenWithdraw,
	onOpenSwap,
	onSellToken,
	onBuyToken,
}: PortfolioScreenProps) {
	const { portfolioChain } = usePortfolioChain()
	const { holdings, totalBalanceUsd: balanceUsd, dailyChangePercent, isLoading } =
		useUserHoldings(portfolioChain)
	const profile = useUserProfile()
	const { lemonTag, isAuthenticating } = useLemonMiniapp()

	const actions = [
		{ ...ACTIONS[0], onClick: onOpenDeposit },
		{ ...ACTIONS[1], onClick: onOpenSwap },
		{ ...ACTIONS[2], onClick: onOpenWithdraw },
	]

	return (
		<div className="flex flex-col h-full overflow-y-auto overflow-x-hidden pb-20">
			<PortfolioHeader
				lemonTag={lemonTag}
				balanceUsd={balanceUsd}
				dailyChangePercent={dailyChangePercent}
				isLoading={isLoading || isAuthenticating}
				profile={profile}
				onOpenDeposit={onOpenDeposit}
			/>

			<PortfolioActions actions={actions} />

			<div className="h-0.5 bg-border m-4" />

			<div className="px-3 sm:px-4 pt-4 flex-1 min-w-0">
				<h2 className="text-base sm:text-lg font-display font-bold uppercase tracking-wide text-foreground mb-8">
					Your Tokens
				</h2>

				{isLoading || isAuthenticating ? (
					<TokenListSkeleton />
				) : holdings.length === 0 ? (
					<TokensEmptyState onBuyNow={onOpenSwap} />
				) : (
					<div className="flex flex-col gap-4 stagger-slide-up min-w-0">
						{holdings.map((holding) => (
							<TokenListItem
								key={holding.token.address ?? holding.token.symbol}
								holding={holding}
								onBuyToken={onBuyToken}
								onSellToken={onSellToken}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
