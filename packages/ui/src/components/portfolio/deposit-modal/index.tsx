import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { NumericKeypad } from '@/components/swap/numeric-keypad'
import { SwipeButton } from '@/components/swap/swipe-button'
import { SuccessScreen } from '@/components/swap/success-screen'
import { DepositModalHeader } from './deposit-modal-header'
import { DepositAmountDisplay } from './deposit-amount-display'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
import { TokenName } from '@lemoncash/mini-app-sdk'

type DepositModalProps = {
	onClose: () => void
}

export function DepositModal({ onClose }: DepositModalProps) {
	const [amount, setAmount] = useState('')
	const [showLemonRequested, setShowLemonRequested] = useState(false)
	const [isProcessing, setIsProcessing] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const { handleDeposit, isInLemonWebView } = useLemonMiniapp()

	const quickAmounts = [25, 50, 100]
	const displayValue = amount || '0'
	const numericValue = parseFloat(amount) || 0
	const isValid = numericValue > 0

	function handleKey(key: string) {
		if (key === '.' && amount.includes('.')) return
		if (amount === '' && key === '.') {
			setAmount('0.')
			return
		}
		setAmount((prev) => prev + key)
		setError(null)
	}

	function handleDelete() {
		setAmount((prev) => prev.slice(0, -1))
		setError(null)
	}

	async function handleSwipeComplete() {
		if (!isValid || numericValue <= 0) return

		setIsProcessing(true)
		setError(null)

		try {
			if (!isInLemonWebView) {
				setError('Please open this app in Lemon Cash to deposit')
				return
			}
			await handleDeposit(amount, TokenName.USDC)
			setShowLemonRequested(true)
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : 'Deposit failed. Please try again.'
			setError(errorMessage)
			console.error('Deposit error:', err)
		} finally {
			setIsProcessing(false)
		}
	}

	if (showLemonRequested) {
		return (
			<Dialog open onOpenChange={(open) => !open && onClose()}>
				<DialogContent fullScreen showCloseButton={false} className="flex flex-col overflow-hidden p-0">
					<DialogTitle className="sr-only">Deposit requested</DialogTitle>
					<DialogDescription className="sr-only">
						Check the Lemon Cash app for confirmation.
					</DialogDescription>
					<SuccessScreen
						title="Deposit requested"
						message="Check the Lemon Cash app for confirmation. If you saw an error there, the deposit did not complete."
						onDismiss={onClose}
						buttonLabel="Done"
						imageSrc="/success-deposit-monkey.webp"
						imageAlt="Monkey depositing coin into pouch"
					/>
				</DialogContent>
			</Dialog>
		)
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent fullScreen showCloseButton={false} className="flex flex-col overflow-hidden">
				<DialogTitle className="sr-only">Deposit</DialogTitle>
				<DialogDescription className="sr-only">
					Enter the amount you want to deposit to your account.
				</DialogDescription>
				<DepositModalHeader onClose={onClose} />
				<DepositAmountDisplay
					displayValue={displayValue}
					isValid={isValid}
					error={error}
					isProcessing={isProcessing}
					quickAmounts={quickAmounts}
					selectedAmount={amount}
					onQuickAmount={(val) => {
						setAmount(val.toString())
						setError(null)
					}}
				/>
				<NumericKeypad onKey={handleKey} onDelete={handleDelete} />
				<div className="px-4 pt-4 pb-8">
					<SwipeButton
						label="Swipe to Deposit"
						disabled={!isValid || isProcessing}
						onSwipeComplete={handleSwipeComplete}
					/>
				</div>
			</DialogContent>
		</Dialog>
	)
}
