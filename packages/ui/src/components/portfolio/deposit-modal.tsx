import { useState } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { NumericKeypad } from '@/components/swap/numeric-keypad'
import { SwipeButton } from '@/components/swap/swipe-button'
import { SuccessScreen } from '@/components/swap/success-screen'
import { useMockTokenState } from '@/contexts/mock-token-state'
import { useUserHoldings } from '@/hooks/use-user-holdings'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
import { TokenName } from '@lemoncash/mini-app-sdk'

type DepositModalProps = {
    onClose: () => void
}

export function DepositModal({ onClose }: DepositModalProps) {
    const [amount, setAmount] = useState('')
    const [showSuccess, setShowSuccess] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { getTotalBalanceUsd } = useUserHoldings()
    const balanceUsd = getTotalBalanceUsd()
    const { isMocking, deposit: mockDeposit } = useMockTokenState()
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
        if (!isValid || numericValue <= 0) {
            return
        }

        setIsProcessing(true)
        setError(null)

        try {
            if (isMocking) {
                await mockDeposit(numericValue, 'USDC')
                setShowSuccess(true)
            } else {
                if (!isInLemonWebView) {
                    setError('Please open this app in Lemon Cash to deposit')
                    return
                }

                await handleDeposit(amount, TokenName.USDC)
                setShowSuccess(true)
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : 'Deposit failed. Please try again.'
            setError(errorMessage)
            console.error('Deposit error:', err)
        } finally {
            setIsProcessing(false)
        }
    }

    if (showSuccess) {
        return (
            <Dialog open onOpenChange={(open) => !open && onClose()}>
                <DialogContent fullScreen showCloseButton={false} className="flex flex-col overflow-hidden p-0">
                    <DialogTitle className="sr-only">Deposit successful!</DialogTitle>
                    <DialogDescription className="sr-only">
                        Your funds have been added to your account.
                    </DialogDescription>
                    <SuccessScreen
                        title="Deposit successful!"
                        message="Your funds have been added to your account."
                        onDismiss={onClose}
                        buttonLabel="Done"
                        imageSrc="/success-monkey.webp"
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
                <div className="flex items-center justify-between px-4 pt-6 pb-2">
                    <div className="w-11" />
                    <h2 className="text-base font-display font-bold uppercase tracking-wide text-foreground">
                        Deposit
                    </h2>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-full !bg-transparent hover:!bg-transparent focus-visible:!ring-0 focus-visible:!ring-offset-0 text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center px-4">
                    <p
                        className={`text-6xl numeric-balance tracking-tight transition-colors ${isValid ? 'text-foreground' : 'text-muted-foreground/30'
                            }`}
                    >
                        ${displayValue}
                    </p>
                    {error && (
                        <p className="text-sm text-destructive font-medium mt-2 text-center max-w-xs">
                            {error}
                        </p>
                    )}
                    {isProcessing && (
                        <p className="text-sm text-muted-foreground font-medium mt-2">
                            Processing deposit...
                        </p>
                    )}
                    <p className="text-sm text-muted-foreground text-center mt-1">
                        Current balance:
                        <span className="font-semibold text-foreground numeric">
                            ${balanceUsd.toFixed(2)} USDC
                        </span>
                    </p>
                </div>

                <div className="flex items-center justify-center gap-2 px-4 pb-4 flex-wrap">
                    {quickAmounts.map((val) => (
                        <Button
                            key={val}
                            type="button"
                            variant={amount === val.toString() ? 'default' : 'secondary'}
                            size="sm"
                            onClick={() => {
                                setAmount(val.toString())
                                setError(null)
                            }}
                            className="numeric rounded-full tap-scale"
                        >
                            ${val}
                        </Button>
                    ))}
                </div>

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
