import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { SwapScreen } from '@/components/swap/swap-screen'
import { TokenSelectModal } from '@/components/swap/token-select-modal'
import { SuccessScreen } from '@/components/swap/success-screen'
import { BottomNav } from '@/components/navigation/bottom-nav'
import { TOKENS, type Token } from '@/lib/tokens'

export const Route = createFileRoute('/swap/')({
	component: SwapPage,
	validateSearch: (search: Record<string, unknown>) => ({
		token: search.token as string | undefined,
		mode: (search.mode as 'buy' | 'sell') || 'buy',
	}),
})

type Modal = 'none' | 'token-select'

// Preload success illustrations so they're cached before the user completes a swap/deposit/withdraw
function preloadSuccessImages() {
	const img1 = new Image()
	img1.src = '/success-monkey.webp'
	const img2 = new Image()
	img2.src = '/success-withdraw-monkey.webp'
}

function SwapPage() {
	const { token: tokenFromUrl, mode: modeFromUrl } = useSearch({ from: '/swap/' })
	const navigate = useNavigate()
	const [modal, setModal] = useState<Modal>('none')
	const [showSwapSuccess, setShowSwapSuccess] = useState(false)

	const [buyToken, setBuyToken] = useState<Token | null>(null)

	useEffect(() => {
		preloadSuccessImages()
	}, [])
	const [sellToken, setSellToken] = useState<Token | null>(null)
	const [swapDirection, setSwapDirection] = useState<'buy' | 'sell'>(modeFromUrl)
	const [tokenSelectSide, setTokenSelectSide] = useState<'buy' | 'sell'>('buy')

	// Sync swapDirection with URL mode param
	useEffect(() => {
		setSwapDirection(modeFromUrl)
	}, [modeFromUrl])

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
		}
	}, [tokenFromUrl, modeFromUrl])

	function handleOpenTokenSelect(side: 'sell' | 'buy') {
		setTokenSelectSide(side)
		setModal('token-select')
	}

	const handleSelectTokenFromSwap = useCallback((token: Token) => {
		const usdc = TOKENS.find((t) => t.symbol === 'USDC')
		if (!usdc) return

		const newMode = tokenSelectSide === 'buy' ? 'buy' : 'sell'
		if (tokenSelectSide === 'buy') {
			setBuyToken(token)
			setSellToken(usdc)
			setSwapDirection('buy')
		} else {
			setSellToken(token)
			setBuyToken(usdc)
			setSwapDirection('sell')
		}
		// Update URL with new mode
		navigate({
			to: '/swap',
			search: {
				token: token.symbol,
				mode: newMode,
			},
			replace: true,
		})
	}, [tokenSelectSide, navigate])

	const handleToggleDirection = useCallback(() => {
		const usdc = TOKENS.find((t) => t.symbol === 'USDC')
		if (!usdc) return

		const newMode = swapDirection === 'buy' ? 'sell' : 'buy'
		let tokenToUpdate: Token | null = null

		if (swapDirection === 'buy') {
			// Currently buying: buyToken is the selected token, sellToken is USDC
			// Toggle to selling: sellToken becomes the selected token, buyToken becomes USDC
			tokenToUpdate = buyToken
			if (buyToken) {
				setSellToken(buyToken)
				setBuyToken(usdc)
			} else {
				// No token selected, just swap USDC positions
				setSellToken(null)
				setBuyToken(usdc)
			}
		} else {
			tokenToUpdate = sellToken
			if (sellToken) {
				setBuyToken(sellToken)
				setSellToken(usdc)
			} else {
				// No token selected, just swap USDC positions
				setBuyToken(null)
				setSellToken(usdc)
			}
		}

		setSwapDirection(newMode)

		navigate({
			to: '/swap',
			search: {
				token: tokenToUpdate?.symbol,
				mode: newMode,
			},
			replace: true,
		})
	}, [buyToken, sellToken, swapDirection, navigate])

	return (
		<main className="min-h-screen bg-background max-w-[430px] mx-auto relative overflow-hidden">
			<div className="h-[calc(100dvh-64px)]">
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
							// Reset URL to buy mode
							navigate({
								to: '/swap',
								search: (prev) => ({
									...prev,
									token: undefined,
									mode: 'buy',
								}),
								replace: true,
							})
						}}
						buttonLabel="Done"
					/>
				)}
			</div>

			<BottomNav />

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
