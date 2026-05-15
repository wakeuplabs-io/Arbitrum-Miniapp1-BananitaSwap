import { useState } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { NumericKeypad } from '@/components/swap/numeric-keypad'
import { ActionButton } from '@/components/swap/action-button'
import { SuccessScreen } from '@/components/swap/success-screen'
import { usePortfolioChain } from '@/contexts/portfolio-chain-context'
import { useUserHoldings } from '@/hooks/use-user-holdings'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
import { TokenName } from '@lemoncash/mini-app-sdk'

type WithdrawalModalProps = {
    onClose: () => void
}

export function WithdrawalModal({ onClose }: WithdrawalModalProps) {
    const [amount, setAmount] = useState('')
    const [showSuccess, setShowSuccess] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { portfolioChain } = usePortfolioChain()
    const { getUsdcBalance, isLoading } = useUserHoldings(portfolioChain)
    const withdrawableUsdc = getUsdcBalance()
    const { handleWithdraw, isInLemonWebView } = useLemonMiniapp()

    const quickAmounts = [25, 50, 100]
    const displayValue = amount || '0'
    const numericValue = parseFloat(amount) || 0
    const effectiveBalance = withdrawableUsdc ?? 0
    const exceedsBalance = numericValue > effectiveBalance
    const isValid = withdrawableUsdc !== null && numericValue > 0 && numericValue <= withdrawableUsdc

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

    async function handleAction() {
        if (!isValid || numericValue <= 0) {
            return
        }

        setIsProcessing(true)
        setError(null)

        try {
            if (!isInLemonWebView) {
                setError('Please open this app in Lemon Cash to withdraw')
                return
            }

            await handleWithdraw(amount, TokenName.USDC)
            setShowSuccess(true)
        } catch (err) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : 'Withdrawal failed. Please try again.'
            setError(errorMessage)
            console.error('Withdrawal error:', err)
        } finally {
            setIsProcessing(false)
        }
    }

    if (showSuccess) {
        return (
            <Dialog open onOpenChange={(open) => !open && onClose()}>
                <DialogContent fullScreen showCloseButton={false} className="flex flex-col overflow-hidden p-0">
                    <DialogTitle className="sr-only">Withdraw successful!</DialogTitle>
                    <DialogDescription className="sr-only">
                        Your withdrawal has been processed.
                    </DialogDescription>
                    <SuccessScreen
                        title="Withdraw successful!"
                        message="Your withdrawal has been processed."
                        onDismiss={onClose}
                        buttonLabel="Done"
                        imageSrc="/success-withdraw-monkey.webp"
                        imageAlt="Monkey holding coin with banana symbol"
                    />
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent fullScreen showCloseButton={false} className="flex flex-col overflow-hidden">
                <DialogTitle className="sr-only">Withdraw</DialogTitle>
                <DialogDescription className="sr-only">
                    Enter the amount you want to withdraw from your account.
                </DialogDescription>
                <div className="flex items-center justify-between px-4 pt-6 pb-2">
                    <div className="w-11" />
                    <h2 className="text-base font-display font-bold uppercase tracking-wide text-foreground">
                        Withdraw
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
                            } ${exceedsBalance ? 'text-destructive' : ''}`}
                    >
                        ${displayValue}
                    </p>
                    {exceedsBalance && (
                        <p className="text-sm text-destructive font-medium mt-2">
                            Exceeds balance
                        </p>
                    )}
                    {error && (
                        <p className="text-sm text-destructive font-medium mt-2 text-center max-w-xs">
                            {error}
                        </p>
                    )}
                    {isProcessing && (
                        <p className="text-sm text-muted-foreground font-medium mt-2">
                            Processing withdrawal...
                        </p>
                    )}
                    <p className="text-sm text-muted-foreground text-center mt-1">
                        Balance available:
                        <span className="font-semibold text-foreground numeric">
                            {isLoading || withdrawableUsdc === null ? '—' : `$${withdrawableUsdc.toFixed(2)}`} USDC
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
                            disabled={isLoading || withdrawableUsdc === null}
                            onClick={() => {
                                setAmount(val.toString())
                                setError(null)
                            }}
                            className="numeric rounded-full tap-scale"
                        >
                            ${val}
                        </Button>
                    ))}
                    {withdrawableUsdc !== null && withdrawableUsdc > 0 && (
                        <Button
                            type="button"
                            variant={amount === withdrawableUsdc.toFixed(2) ? 'default' : 'secondary'}
                            size="sm"
                            onClick={() => {
                                setAmount(withdrawableUsdc.toFixed(2))
                                setError(null)
                            }}
                            className="numeric rounded-full tap-scale"
                        >
                            Max
                        </Button>
                    )}
                </div>

                <NumericKeypad onKey={handleKey} onDelete={handleDelete} />

                <div className="px-4 pt-4 pb-8">
                    <ActionButton
                        label="Withdraw"
                        disabled={!isValid || isProcessing}
                        onClick={handleAction}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
