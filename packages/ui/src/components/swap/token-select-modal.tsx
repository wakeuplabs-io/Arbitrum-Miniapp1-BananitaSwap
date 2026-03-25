import { useState, useMemo } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TokenIcon } from './token-icon'
import { formatPrice } from '@/lib/utils'
import { useAllTokens } from '@/hooks/use-tokens'
import { useUserHoldings } from '@/hooks/use-user-holdings'
import type { Token } from '@/lib/tokens'

type TokenSelectModalProps = {
	onClose: () => void
	onSelect?: (token: Token) => void
	excludeSymbol?: string
	navigateToDetailOnSelect?: boolean
	mode?: 'buy' | 'sell'
}

/**
 * Filter tokens by excludeSymbol (shared utility)
 */
function filterByExcludeSymbol(tokens: Token[], excludeSymbol?: string): Token[] {
	if (!excludeSymbol) return tokens
	return tokens.filter((t) => t.symbol !== excludeSymbol)
}

/**
 * Filter tokens by search query (client-side filtering).
 * Requires at least 2 characters to filter; otherwise returns full list.
 */
function filterBySearchQuery(tokens: Token[], query: string): Token[] {
	const trimmed = query.trim()
	if (trimmed.length < 2) return tokens

	const queryLower = trimmed.toLowerCase()
	return tokens.filter((t) => {
		const symbolMatch = t.symbol?.toLowerCase().includes(queryLower)
		const nameMatch = t.name?.toLowerCase().includes(queryLower)
		const addressMatch = t.address?.toLowerCase().includes(queryLower)
		return symbolMatch || nameMatch || addressMatch
	})
}

/**
 * Hook for buy mode token selection.
 * Filters allTokens client-side for instant search (no API call).
 */
function useBuyModeTokens(query: string, excludeSymbol?: string) {
	const { data: allTokens = [], isLoading } = useAllTokens()

	const tokens = useMemo(() => {
		const filteredBySearch = filterBySearchQuery(allTokens, query)
		return filterByExcludeSymbol(filteredBySearch, excludeSymbol)
	}, [allTokens, query, excludeSymbol])

	return { tokens, isLoading }
}

/**
 * Hook for sell mode token selection
 */
function useSellModeTokens(query: string, excludeSymbol?: string) {
	const { holdings, isLoading } = useUserHoldings('mainnet')

	// Extract tokens from holdings (which include mock tokens)
	const tokens = useMemo(() => {
		const tokenList = holdings.map((h) => h.token)
		const filteredBySearch = filterBySearchQuery(tokenList, query)
		return filterByExcludeSymbol(filteredBySearch, excludeSymbol)
	}, [holdings, query, excludeSymbol])

	return { tokens, isLoading }
}

export function TokenSelectModal({
	onClose,
	onSelect,
	excludeSymbol,
	navigateToDetailOnSelect = false,
	mode = 'buy',
}: TokenSelectModalProps) {
	const [query, setQuery] = useState('')

	// Get tokens based on mode
	const buyModeData = useBuyModeTokens(query, excludeSymbol)
	const sellModeData = useSellModeTokens(query, excludeSymbol)

	const { tokens, isLoading } = mode === 'buy' ? buyModeData : sellModeData

	function handleSelectToken(token: Token) {
		console.log('[TokenSelectModal] Selected token data:', {
			symbol: token.symbol,
			name: token.name,
			icon: token.icon,
			logoUrl: token.logoUrl,
			color: token.color,
			price: token.price,
			change24h: token.change24h,
			marketCap: token.marketCap,
			balance: token.balance,
			address: token.address,
			chainId: token.chainId,
			dexId: token.dexId,
			fullToken: token,
		})

		if (navigateToDetailOnSelect) {
			onClose()
		} else if (onSelect) {
			onSelect(token)
			onClose()
		}
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent fullScreen showCloseButton={false} className="overflow-hidden">
				<DialogTitle className="sr-only">
					{query.trim() ? 'Search Results' : 'Popular Tokens'}
				</DialogTitle>
				<DialogDescription className="sr-only">
					Select a token to trade. Search by token name, symbol, or address.
				</DialogDescription>
				<div className="flex flex-1 flex-col overflow-hidden">
					<div className="px-4 pt-6 pb-4">
						<div className="flex items-center gap-3 rounded-full border-2 border-border bg-card px-4 py-3 shadow-sm">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={onClose}
								aria-label="Back"
								className="shrink-0 rounded-full hover:!bg-muted hover:!text-foreground focus-visible:!ring-0 focus-visible:!ring-offset-0 active:!bg-muted"
							>
								<ArrowLeft className="w-5 h-5 text-muted-foreground" />
							</Button>
							<Input
								type="search"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search by name or address"
								aria-label="Search tokens"
								className="border-0 bg-transparent text-sm font-sans text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
								autoFocus
							/>
						</div>
					</div>

					<div className="px-4 pb-3">
						<h3 className="text-base font-display font-bold uppercase tracking-wide text-foreground">
							{mode === 'sell'
								? query.trim().length > 0
									? 'Search Results'
									: 'Your Tokens'
								: query.trim().length >= 3
									? 'Search Results'
									: 'Popular Tokens'}
						</h3>
					</div>

					<div className="flex-1 overflow-y-auto px-4 pb-4 stagger-slide-up">
						{isLoading ? (
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : tokens.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<p className="text-sm text-muted-foreground">
									{query.trim().length > 0
										? 'No tokens found. Try a different search.'
										: 'No tokens available.'}
								</p>
							</div>
						) : (
							tokens.map((token) => (
								<button
									key={`${token.address || token.symbol}-${token.dexId || 'unknown'}`}
									type="button"
									onClick={() => handleSelectToken(token)}
									className="flex w-full items-center gap-3 px-3 py-4 rounded-2xl transition-colors hover:bg-muted/50 active:bg-muted tap-scale"
								>
									<TokenIcon
										symbol={token.symbol}
										color={token.color}
										logoUrl={token.logoUrl}
										size={40}
									/>
									<div className="flex min-w-0 flex-1 flex-col items-start">
										<div className="flex items-center gap-2">
											<span className="text-sm font-display font-semibold text-foreground">
												{token.symbol}
											</span>
											{token.dexId && (
												<span className="text-[10px] font-sans font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
													{token.dexId}
												</span>
											)}
										</div>
										<span className="text-xs font-sans text-muted-foreground">
											{token.marketCap} Market Cap
										</span>
									</div>
									<div className="flex shrink-0 flex-col items-end">
										<span className="text-sm numeric font-semibold text-foreground">
											{formatPrice(token.price)}
										</span>
										<span
											className={`text-xs numeric ${token.change24h == null
													? 'text-muted-foreground'
													: token.change24h >= 0
														? 'text-success'
														: 'text-destructive'
												}`}
										>
											{token.change24h == null
												? '-'
												: `${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(3)}%`}
										</span>
									</div>
								</button>
							))
						)}
					</div>

					<p className="px-4 pb-6 pt-2 text-center text-xs text-muted-foreground">
						Trades are powered by Camelot and currently support Arbitrum tokens only.
					</p>
				</div>
			</DialogContent>
		</Dialog>
	)
}
