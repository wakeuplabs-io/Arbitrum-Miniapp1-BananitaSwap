import { createFileRoute } from '@tanstack/react-router'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
import { withLemonWebView } from '@/hocs/with-lemon-webview'
import { Button } from '@/components/ui/button'
import { TokenName } from '@lemoncash/mini-app-sdk'

function LemonDemoPage() {
    const { wallet, isAuthenticated, handleAuthentication, handleDeposit, isAuthenticating } =
        useLemonMiniapp()

    async function handleDepositClick() {
        try {
            await handleDeposit('100', TokenName.USDC)
            alert('Deposit successful!')
        } catch (error) {
            alert(`Deposit failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    return (
        <main className="min-h-screen bg-background max-w-[430px] mx-auto p-6 flex flex-col items-center justify-center gap-6">
            <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold">Lemon Cash Mini App</h1>
                <p className="text-muted-foreground">Quickstart Demo</p>
            </div>

            <div className="w-full space-y-4">
                <div className="p-4 border rounded-lg">
                    <h2 className="font-semibold mb-2">Wallet Status</h2>
                    {isAuthenticating ? (
                        <p className="text-muted-foreground">Authenticating...</p>
                    ) : isAuthenticated && wallet ? (
                        <p className="font-mono text-sm break-all">
                            {wallet.slice(0, 8)}...{wallet.slice(-8)}
                        </p>
                    ) : (
                        <p className="text-muted-foreground">Not authenticated</p>
                    )}
                </div>

                <Button
                    onClick={handleAuthentication}
                    disabled={isAuthenticating || isAuthenticated}
                    className="w-full"
                >
                    {isAuthenticating ? 'Authenticating...' : isAuthenticated ? 'Authenticated' : 'Authenticate'}
                </Button>

                <Button
                    onClick={handleDepositClick}
                    disabled={!isAuthenticated}
                    className="w-full"
                    variant="outline"
                >
                    {isAuthenticated ? 'Send 100 USDC' : 'Authenticate first'}
                </Button>
            </div>
        </main>
    )
}

export const Route = createFileRoute('/lemon-demo/')({
    component: withLemonWebView(LemonDemoPage),
})
