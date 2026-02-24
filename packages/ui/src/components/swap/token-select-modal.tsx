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
import { useAllTokens, useTokenSearch } from '@/hooks/use-tokens'
import { useDebounce } from '@/hooks/use-debounce'
import type { Token } from '@/lib/tokens'

type TokenSelectModalProps = {
	onClose: () => void
	onSelect?: (token: Token) => void
	excludeSymbol?: string
	navigateToDetailOnSelect?: boolean
}

export function TokenSelectModal({
	onClose,
	onSelect,
	excludeSymbol,
	navigateToDetailOnSelect = false,
}: TokenSelectModalProps) {
	const [query, setQuery] = useState('')
	const debouncedQuery = useDebounce(query, 300)

	// Use search API when query is provided, otherwise use all tokens
	const { data: allTokens = [], isLoading: isLoadingAll } = useAllTokens()
	const { data: searchResults = [], isLoading: isLoadingSearch } = useTokenSearch(debouncedQuery)

	// Check if user has typed enough characters to search (use immediate query, not debounced)
	const shouldShowSearch = query.trim().length >= 3
	const isLoading = shouldShowSearch ? isLoadingSearch : isLoadingAll

	// Use search results when query exists and is at least 3 characters, otherwise use all tokens
	const tokens = useMemo(() => {
		const tokenList = shouldShowSearch ? searchResults : allTokens

		// Filter by excludeSymbol
		return tokenList.filter((t) => {
			if (excludeSymbol && t.symbol === excludeSymbol) return false
			return true
		})
	}, [query, shouldShowSearch, searchResults, allTokens, excludeSymbol])

	function handleSelectToken(token: Token) {
		if (navigateToDetailOnSelect) {
			onClose()
		} else if (onSelect) {
			onSelect(token)
			onClose()
		}
	}

	function formatPrice(price: number) {
		if (price < 0.001) return `$${price.toFixed(7)}`
		if (price < 1) return `$${price.toFixed(4)}`
		if (price >= 1000)
			return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
		return `$${price.toFixed(2)}`
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
							{query.trim().length >= 3 ? 'Search Results' : 'Popular Tokens'}
						</h3>
					</div>

					<div className="flex-1 overflow-y-auto px-4 pb-6 stagger-slide-up">
						{isLoading ? (
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : tokens.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<p className="text-sm text-muted-foreground">
									{query.trim().length >= 3
										? 'No tokens found. Try a different search.'
										: query.trim().length > 0
											? 'Type at least 3 characters to search'
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
											className={`text-xs numeric ${token.change24h >= 0 ? 'text-success' : 'text-destructive'
												}`}
										>
											{token.change24h >= 0 ? '+' : ''}
											{token.change24h.toFixed(3)}%
										</span>
									</div>
								</button>
							))
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
