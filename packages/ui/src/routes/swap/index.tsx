import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { ArrowLeftRight, Wallet } from 'lucide-react'
import { SwapScreen } from '@/components/swap/swap-screen'
import { PortfolioScreen } from '@/components/swap/portfolio-screen'
import { DepositModal } from '@/components/swap/deposit-modal'
import { TokenSelectModal } from '@/components/swap/token-select-modal'
import { SuccessScreen } from '@/components/swap/success-screen'
import { TOKENS, type Token } from '@/lib/tokens'

export const Route = createFileRoute('/swap/')({
	component: SwapPage,
	validateSearch: (search: Record<string, unknown>) => ({
		token: search.token as string | undefined,
		mode: (search.mode as 'buy' | 'sell') || 'buy',
	}),
})

type Tab = 'swap' | 'portfolio'
type Modal = 'none' | 'deposit' | 'withdraw' | 'token-select'

const tabs = [
	{ id: 'swap' as Tab, label: 'Swap', icon: ArrowLeftRight },
	{ id: 'portfolio' as Tab, label: 'Portfolio', icon: Wallet },
]

function NavTabButton({
	tab,
	isActive,
	onSelect,
}: {
	tab: (typeof tabs)[number]
	isActive: boolean
	onSelect: () => void
}) {
	return (
		<div
			role="tab"
			tabIndex={0}
			aria-label={tab.label}
			aria-selected={isActive}
			onPointerDown={(e) => {
				e.preventDefault()
				onSelect()
			}}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault()
					onSelect()
				}
			}}
			className={`nav-tab-btn flex flex-col items-center justify-center gap-1 h-16 py-2 px-6 rounded-none !bg-transparent cursor-pointer transition-colors duration-200 select-none ${isActive
				? 'text-primary font-bold [@media(hover:hover)]:hover:bg-[#FFC700] [@media(hover:hover)]:hover:text-[#0A0A0A]'
				: 'text-muted-foreground [@media(hover:hover)]:hover:text-foreground [@media(hover:hover)]:hover:bg-muted/50'
				}`}
		>
			<tab.icon className={`w-5 h-5 shrink-0 nav-tab-icon ${isActive ? 'drop-shadow-sm nav-tab-icon-active' : ''}`} />
			<span className="text-xs font-display font-bold uppercase tracking-wide">
				{tab.label}
			</span>
		</div>
	)
}

// Preload success illustrations so they're cached before the user completes a swap/deposit/withdraw
function preloadSuccessImages() {
	const img1 = new Image()
	img1.src = '/success-monkey.webp'
	const img2 = new Image()
	img2.src = '/success-withdraw-monkey.webp'
}

function SwapPage() {
	const { token: tokenFromUrl, mode: modeFromUrl } = useSearch({ from: '/swap/' })
	const [activeTab, setActiveTab] = useState<Tab>('swap')
	const [modal, setModal] = useState<Modal>('none')
	const [showSwapSuccess, setShowSwapSuccess] = useState(false)

	const [buyToken, setBuyToken] = useState<Token | null>(null)

	useEffect(() => {
		preloadSuccessImages()
	}, [])
	const [sellToken, setSellToken] = useState<Token | null>(null)
	const [swapDirection, setSwapDirection] = useState<'buy' | 'sell'>('buy')
	const [tokenSelectSide, setTokenSelectSide] = useState<'buy' | 'sell'>('buy')

	useEffect(() => {
		if (!tokenFromUrl) return
		const usdc = TOKENS.find((t) => t.symbol === 'USDC')
		const t = TOKENS.find(
			(tok) => tok.symbol.toUpperCase() === tokenFromUrl.toUpperCase()
		)
		if (t && t.symbol !== 'USDC' && usdc) {
			if (modeFromUrl === 'buy') {
				setBuyToken(t)
				setSellToken(usdc)
				setSwapDirection('buy')
			} else {
				setSellToken(t)
				setBuyToken(usdc)
				setSwapDirection('sell')
			}
			setActiveTab('swap')
		}
	}, [tokenFromUrl, modeFromUrl])

	function handleOpenTokenSelect(side: 'sell' | 'buy') {
		setTokenSelectSide(side)
		setModal('token-select')
	}

	const handleSelectTokenFromSwap = useCallback((token: Token) => {
		if (tokenSelectSide === 'buy') {
			setBuyToken(token)
			setSellToken(null)
			setSwapDirection('buy')
		} else {
			setSellToken(token)
			setBuyToken(null)
			setSwapDirection('sell')
		}
	}, [tokenSelectSide])

	const handleToggleDirection = useCallback(() => {
		setSwapDirection((prev) => {
			if (prev === 'buy') {
				if (buyToken) setSellToken(buyToken)
				setBuyToken(null)
				return 'sell'
			}
			if (sellToken) setBuyToken(sellToken)
			setSellToken(null)
			return 'buy'
		})
	}, [buyToken, sellToken])

	const handlePortfolioSell = useCallback((token: Token) => {
		setSellToken(token)
		setBuyToken(null)
		setSwapDirection('sell')
		setActiveTab('swap')
	}, [])

	const handlePortfolioBuy = useCallback((token: Token) => {
		setBuyToken(token)
		setSellToken(null)
		setSwapDirection('buy')
		setActiveTab('swap')
	}, [])

	return (
		<main className="min-h-screen bg-background max-w-[430px] mx-auto relative overflow-hidden">
			<div className="h-[calc(100dvh-64px)]">
				{activeTab === 'swap' && (
					<>
						<SwapScreen
							onOpenTokenSelect={handleOpenTokenSelect}
							buyToken={buyToken}
							sellToken={sellToken}
							direction={swapDirection}
							onToggleDirection={handleToggleDirection}
							onSwapComplete={() => setShowSwapSuccess(true)}
						/>
						{showSwapSuccess && (
							<SuccessScreen
								title={swapDirection === 'buy' ? 'Buy successful!' : 'Sell successful!'}
								message="Your swap has been completed."
								onDismiss={() => {
									setShowSwapSuccess(false)
									setBuyToken(null)
									setSellToken(null)
									setSwapDirection('buy')
								}}
								buttonLabel="Done"
							/>
						)}
					</>
				)}
				{activeTab === 'portfolio' && (
					<PortfolioScreen
						onOpenDeposit={() => setModal('deposit')}
						onOpenWithdraw={() => setModal('withdraw')}
						onOpenSwap={() => setActiveTab('swap')}
						onSellToken={handlePortfolioSell}
						onBuyToken={handlePortfolioBuy}
					/>
				)}
			</div>

			<nav className="nav-tabs fixed bottom-0 left-0 right-0 w-full bg-[#FFFFFF] border-t-2 border-border max-w-[430px] mx-auto z-50 shadow-lg transition-shadow duration-200" role="tablist">
				<div className="flex items-center justify-around h-16">
					{tabs.map((tab) => (
						<NavTabButton
							key={tab.id}
							tab={tab}
							isActive={activeTab === tab.id}
							onSelect={() => setActiveTab(tab.id)}
						/>
					))}
				</div>
			</nav>

			{modal === 'deposit' && (
				<DepositModal onClose={() => setModal('none')} mode="deposit" />
			)}

			{modal === 'withdraw' && (
				<DepositModal onClose={() => setModal('none')} mode="withdraw" />
			)}

			{modal === 'token-select' && (
				<TokenSelectModal
					onClose={() => setModal('none')}
					onSelect={handleSelectTokenFromSwap}
					excludeSymbol="USDC"
				/>
			)}
		</main>
	)
}
