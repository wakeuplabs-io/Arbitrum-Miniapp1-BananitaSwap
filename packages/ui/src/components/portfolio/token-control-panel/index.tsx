import { useState, useCallback, useEffect } from 'react'
import { Settings2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { usePortfolioChain } from '@/contexts/portfolio-chain-context'
import { useMockTokenState } from '@/contexts/mock-token-state'
import { useUserHoldings } from '@/hooks/use-user-holdings'
import { useAllTokens } from '@/hooks/use-tokens'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
import { TokenControlPanelHeader } from './token-control-panel-header'
import { PortfolioChainSelector } from './portfolio-chain-selector'
import { WalletAddressControl } from './wallet-address-control'
import { CurrentHoldingsList } from './current-holdings-list'
import { AddTokenForm } from './add-token-form'

export function TokenControlPanel() {
	const [isOpen, setIsOpen] = useState(false)
	const { portfolioChain, setPortfolioChain } = usePortfolioChain()
	const { updateTokenAmount, addToken, removeToken, resetToDefault, isMocking } = useMockTokenState()
	const { holdings, getAvailableTokens } = useUserHoldings(portfolioChain)
	const { data: allTokens } = useAllTokens()
	const { wallet, setWallet } = useLemonMiniapp()
	const [selectedTokenSymbol, setSelectedTokenSymbol] = useState<string>('')
	const [newTokenAmount, setNewTokenAmount] = useState<string>('')
	const [walletAddressInput, setWalletAddressInput] = useState<string>(wallet || '')

	const handleAddToken = useCallback(() => {
		if (!selectedTokenSymbol || !newTokenAmount) return
		const token = allTokens?.find((t) => t.symbol === selectedTokenSymbol)
		if (!token) return
		const amount = parseFloat(newTokenAmount)
		if (isNaN(amount) || amount <= 0) return
		addToken(token, amount)
		setSelectedTokenSymbol('')
		setNewTokenAmount('')
	}, [selectedTokenSymbol, newTokenAmount, allTokens, addToken])

	const handleSetWallet = useCallback(() => {
		const address = walletAddressInput.trim()
		setWallet(address || undefined)
	}, [walletAddressInput, setWallet])

	const handleClearWallet = useCallback(() => {
		setWallet(undefined)
		setWalletAddressInput('')
	}, [setWallet])

	const handleResetToDefault = useCallback(() => {
		resetToDefault()
		setWallet(undefined)
		setWalletAddressInput('')
	}, [resetToDefault, setWallet])

	useEffect(() => {
		setWalletAddressInput(wallet || '')
	}, [wallet])

	const availableTokens = allTokens ? getAvailableTokens(allTokens) : []

	return (
		<>
			<div className="fixed bottom-20 left-0 right-0 z-50 flex justify-end pointer-events-none px-4 sm:px-6 max-w-[430px] mx-auto">
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
					aria-label="Open token control panel"
				>
					<Settings2 className="h-5 w-5" />
				</button>
			</div>

			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent
					fullScreen
					showCloseButton={false}
					className="flex flex-col overflow-hidden p-0 max-w-full sm:max-w-[430px]"
				>
					<DialogTitle className="sr-only">Token Control Panel</DialogTitle>
					<DialogDescription className="sr-only">
						Manage your token holdings and wallet address for testing and development.
					</DialogDescription>

					<TokenControlPanelHeader isMocking={isMocking} onClose={() => setIsOpen(false)} />

					<div className="flex-1 overflow-y-auto p-4 space-y-4">
						<PortfolioChainSelector value={portfolioChain} onChange={setPortfolioChain} />

						<WalletAddressControl
							value={walletAddressInput}
							onChange={setWalletAddressInput}
							currentWallet={wallet}
							onSet={handleSetWallet}
							onClear={handleClearWallet}
						/>

						<div className="flex justify-end">
							<Button
								type="button"
								variant="outline"
								size="xs"
								onClick={handleResetToDefault}
								disabled={!isMocking && !wallet}
								className="rounded-full"
							>
								<RotateCcw className="h-3 w-3 mr-1" />
								Reset to Default
							</Button>
						</div>

						<CurrentHoldingsList
							holdings={holdings}
							isMocking={isMocking}
							onUpdateAmount={updateTokenAmount}
							onRemove={removeToken}
						/>

						<AddTokenForm
							availableTokens={availableTokens}
							selectedSymbol={selectedTokenSymbol}
							amount={newTokenAmount}
							onSelectSymbol={setSelectedTokenSymbol}
							onAmountChange={setNewTokenAmount}
							onAdd={handleAddToken}
						/>
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}
