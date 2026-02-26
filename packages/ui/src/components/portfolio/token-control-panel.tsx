import { useState, useCallback, useEffect } from 'react'
import { Settings2, X, Plus, Trash2, RotateCcw, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useMockTokenState } from '@/contexts/mock-token-state'
import { useUserHoldings } from '@/hooks/use-user-holdings'
import { useAllTokens } from '@/hooks/use-tokens'
import { TokenIcon } from '@/components/swap/token-icon'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'

export function TokenControlPanel() {
    const [isOpen, setIsOpen] = useState(false)

    const {
        updateTokenAmount,
        addToken,
        removeToken,
        resetToDefault,
        isMocking,
    } = useMockTokenState()

    const { holdings, getAvailableTokens } = useUserHoldings()
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
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                aria-label="Open token control panel"
            >
                <Settings2 className="h-5 w-5" />
            </button>

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

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 pt-6 pb-2 border-b border-border">
                        <div className="flex items-center gap-2">
                            <Settings2 className="h-4 w-4 text-muted-foreground" />
                            <h2 className="text-base font-display font-bold uppercase tracking-wide text-foreground">
                                Token Control Panel
                            </h2>
                            {isMocking && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono">
                                    MOCK
                                </span>
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsOpen(false)}
                            className="rounded-full !bg-transparent hover:!bg-transparent focus-visible:!ring-0 focus-visible:!ring-offset-0 text-muted-foreground hover:text-foreground"
                            aria-label="Close panel"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Content - scrollable */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Wallet Address Control */}
                        <div>
                            <h4 className="text-xs font-display font-semibold uppercase tracking-wide text-foreground mb-2 flex items-center gap-2">
                                <Wallet className="h-3 w-3" />
                                Wallet Address
                            </h4>
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        value={walletAddressInput}
                                        onChange={(e) => setWalletAddressInput(e.target.value)}
                                        placeholder="0x..."
                                        className="flex-1 h-8 text-xs font-mono"
                                    />
                                    <Button
                                        type="button"
                                        variant="default"
                                        size="xs"
                                        onClick={handleSetWallet}
                                        className="rounded-full"
                                    >
                                        Set
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="xs"
                                        onClick={handleClearWallet}
                                        disabled={!wallet}
                                        className="rounded-full"
                                    >
                                        Clear
                                    </Button>
                                </div>
                                {wallet && (
                                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                                        Current: {wallet}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Reset button */}
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

                        {/* Current Holdings */}
                        <div>
                            <h4 className="text-xs font-display font-semibold uppercase tracking-wide text-foreground mb-2">
                                Current Holdings
                            </h4>
                            <div className="space-y-2">
                                {holdings.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-4">
                                        No tokens
                                    </p>
                                ) : (
                                    holdings.map((holding) => (
                                        <div
                                            key={holding.token.symbol}
                                            className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border"
                                        >
                                            <TokenIcon
                                                symbol={holding.token.symbol}
                                                color={holding.token.color}
                                                logoUrl={holding.token.logoUrl}
                                                size={24}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-foreground truncate">
                                                    {holding.token.symbol}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    ${holding.token.price.toFixed(2)}
                                                </p>
                                            </div>
                                            <Input
                                                type="number"
                                                value={holding.amount}
                                                onChange={(e) => {
                                                    const value = parseFloat(e.target.value)
                                                    if (!isNaN(value) && value >= 0) {
                                                        updateTokenAmount(holding.token.symbol, value)
                                                    }
                                                }}
                                                step="0.01"
                                                min="0"
                                                className="w-20 h-7 text-xs"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => removeToken(holding.token.symbol)}
                                                disabled={!isMocking && holdings.length === 1}
                                                className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                                aria-label={`Remove ${holding.token.symbol}`}
                                                title={!isMocking && holdings.length === 1 ? 'Cannot remove the last token when not mocking' : `Remove ${holding.token.symbol}`}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Add Token */}
                        <div>
                            <h4 className="text-xs font-display font-semibold uppercase tracking-wide text-foreground mb-2">
                                Add Token
                            </h4>
                            <div className="space-y-2">
                                <select
                                    value={selectedTokenSymbol}
                                    onChange={(e) => setSelectedTokenSymbol(e.target.value)}
                                    className="w-full h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="">Select a token...</option>
                                    {availableTokens.map((token) => (
                                        <option key={token.symbol} value={token.symbol}>
                                            {token.symbol} - {token.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={newTokenAmount}
                                        onChange={(e) => setNewTokenAmount(e.target.value)}
                                        placeholder="Amount"
                                        step="0.01"
                                        min="0"
                                        className="flex-1 h-8 text-xs"
                                    />
                                    <Button
                                        type="button"
                                        variant="default"
                                        size="xs"
                                        onClick={handleAddToken}
                                        disabled={!selectedTokenSymbol || !newTokenAmount}
                                        className="rounded-full"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
