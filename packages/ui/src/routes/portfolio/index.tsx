import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { PortfolioScreen } from '@/components/portfolio/portfolio-screen'
import { DepositWithdrawModal } from '@/components/portfolio/deposit-withdraw-modal'
import { BottomNav } from '@/components/navigation/bottom-nav'
import type { Token } from '@/lib/tokens'

export const Route = createFileRoute('/portfolio/')({
  component: PortfolioPage,
  validateSearch: (search: Record<string, unknown>) => ({
    action: (search.action as 'deposit' | 'withdraw') || undefined,
  }),
})

function PortfolioPage() {
  const { action } = useSearch({ from: '/portfolio/' })
  const navigate = useNavigate()

  const handleOpenDeposit = () => {
    navigate({
      to: '/portfolio',
      search: { action: 'deposit' },
    })
  }

  const handleOpenWithdraw = () => {
    navigate({
      to: '/portfolio',
      search: { action: 'withdraw' },
    })
  }

  const handleCloseModal = () => {
    // Navigate to portfolio without action search param
    navigate({
      to: '/portfolio',
      search: (prev) => ({ ...prev, action: undefined as any }),
      replace: true,
    })
  }

  const handleOpenSwap = () => {
    navigate({
      to: '/swap',
      search: {
        token: undefined,
        mode: 'buy',
      },
    })
  }

  const handlePortfolioSell = (token: Token) => {
    navigate({
      to: '/swap',
      search: {
        token: token.symbol,
        mode: 'sell',
      },
    })
  }

  const handlePortfolioBuy = (token: Token) => {
    navigate({
      to: '/swap',
      search: {
        token: token.symbol,
        mode: 'buy',
      },
    })
  }

  return (
    <main className="min-h-screen bg-background max-w-[430px] mx-auto relative overflow-hidden">
      <div className="h-[calc(100dvh-64px)]">
        <PortfolioScreen
          onOpenDeposit={handleOpenDeposit}
          onOpenWithdraw={handleOpenWithdraw}
          onOpenSwap={handleOpenSwap}
          onSellToken={handlePortfolioSell}
          onBuyToken={handlePortfolioBuy}
        />
      </div>

      <BottomNav />

      {action === 'deposit' && (
        <DepositWithdrawModal onClose={handleCloseModal} mode="deposit" />
      )}

      {action === 'withdraw' && (
        <DepositWithdrawModal onClose={handleCloseModal} mode="withdraw" />
      )}
    </main>
  )
}
