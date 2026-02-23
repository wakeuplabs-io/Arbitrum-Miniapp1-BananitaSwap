import { isLemonWebView } from '@lemoncash/mini-app-sdk'
import React, { useEffect, useState } from 'react'

interface WithLemonWebViewOptions {
    fallback?: React.ReactNode
    showLoading?: boolean
}

export function withLemonWebView<P extends object>(
    Component: React.ComponentType<P>,
    options?: WithLemonWebViewOptions
) {
    return function LemonWebViewComponent(props: P) {
        const [inWebView, setInWebView] = useState<boolean | null>(null)
        const [ready, setReady] = useState(false)

        useEffect(() => {
            async function checkWebView() {
                const result = await isLemonWebView()
                setInWebView(result)
                setReady(true)
            }
            checkWebView()
        }, [])

        // Show loading while checking WebView status
        if (!ready || (options?.showLoading && inWebView === null)) {
            return (
                <div className="flex w-screen h-screen items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Cargando...</p>
                    </div>
                </div>
            )
        }

        // If not in WebView, show fallback or default message
        if (!inWebView) {
            return (
                options?.fallback || (
                    <div className="flex items-center justify-center min-h-screen p-4">
                        <div className="text-center">
                            <h1 className="text-2xl font-bold mb-4">Please open this app in Lemon Cash</h1>
                            <p className="text-muted-foreground">
                                This Mini App requires the Lemon Cash app to function properly.
                            </p>
                        </div>
                    </div>
                )
            )
        }

        // Render the component with original props
        return <Component {...props} />
    }
}
