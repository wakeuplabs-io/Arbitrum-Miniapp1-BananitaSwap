import { useState, useCallback, useRef, useEffect } from 'react'
import { Settings2, X, Plus, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMockTokenState, useCurrentHoldings } from '@/contexts/mock-token-state'
import { useAllTokens } from '@/hooks/use-tokens'
import { TokenIcon } from '@/components/swap/token-icon'

export function TokenControlPanel() {
    const [isOpen, setIsOpen] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [position, setPosition] = useState({ x: 20, y: 20 })
    const dragStartRef = useRef<{ x: number; y: number } | null>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    const {
        updateTokenAmount,
        addToken,
        removeToken,
        resetToDefault,
        isMocking,
    } = useMockTokenState()

    const { holdings, getAvailableTokens } = useCurrentHoldings()
    const { data: allTokens } = useAllTokens()
    const [selectedTokenSymbol, setSelectedTokenSymbol] = useState<string>('')
    const [newTokenAmount, setNewTokenAmount] = useState<string>('')

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!panelRef.current) return
        const rect = panelRef.current.getBoundingClientRect()
        dragStartRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        }
        setIsDragging(true)
    }, [])

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDragging || !dragStartRef.current) return
            const newX = e.clientX - dragStartRef.current.x
            const newY = e.clientY - dragStartRef.current.y
            setPosition({
                x: Math.max(0, Math.min(newX, window.innerWidth - 400)),
                y: Math.max(0, Math.min(newY, window.innerHeight - 500)),
            })
        },
        [isDragging]
    )

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
        dragStartRef.current = null
    }, [])

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
            return () => {
                window.removeEventListener('mousemove', handleMouseMove)
                window.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

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

    const availableTokens = allTokens ? getAvailableTokens(allTokens) : []

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                aria-label="Open token control panel"
            >
                <Settings2 className="h-5 w-5" />
            </button>
        )
    }

    return (
        <div
            ref={panelRef}
            className="fixed z-50 w-[380px] max-h-[600px] bg-card border-2 border-border rounded-lg shadow-2xl flex flex-col"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                cursor: isDragging ? 'grabbing' : 'default',
            }}
        >
            {/* Header - draggable */}
            <div
                onMouseDown={handleMouseDown}
                className="flex items-center justify-between p-3 border-b border-border cursor-grab active:cursor-grabbing bg-muted/50"
            >
                <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-display font-bold uppercase tracking-wide text-foreground">
                        Token Control Panel
                    </h3>
                    {isMocking && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono">
                            MOCK
                        </span>
                    )}
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIsOpen(false)}
                    className="rounded-full"
                    aria-label="Close panel"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Reset button */}
                <div className="flex justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={resetToDefault}
                        disabled={!isMocking}
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
        </div>
    )
}
