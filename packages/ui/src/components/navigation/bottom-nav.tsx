import { useNavigate, useLocation } from '@tanstack/react-router'
import { ArrowLeftRight, Wallet } from 'lucide-react'

const tabs = [
    { id: 'swap', label: 'Swap', icon: ArrowLeftRight, path: '/swap' },
    { id: 'portfolio', label: 'Portfolio', icon: Wallet, path: '/portfolio' },
]

function NavTabButton({
    tab,
    isActive,
    onSelect,
}: {
    tab: (typeof tabs)[number]
    isActive: boolean
    onSelect: () => void
}) {
    return (
        <div
            role="tab"
            tabIndex={0}
            aria-label={tab.label}
            aria-selected={isActive}
            onPointerDown={(e) => {
                e.preventDefault()
                onSelect()
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect()
                }
            }}
            className={`nav-tab-btn flex flex-col items-center justify-center gap-1 h-16 py-2 px-6 rounded-none !bg-transparent cursor-pointer transition-colors duration-200 select-none ${isActive
                ? 'text-primary font-bold [@media(hover:hover)]:hover:bg-[#FFC700] [@media(hover:hover)]:hover:text-[#0A0A0A]'
                : 'text-muted-foreground [@media(hover:hover)]:hover:text-foreground [@media(hover:hover)]:hover:bg-muted/50'
                }`}
        >
            <tab.icon className={`w-5 h-5 shrink-0 nav-tab-icon ${isActive ? 'drop-shadow-sm nav-tab-icon-active' : ''}`} />
            <span className="text-xs font-display font-bold uppercase tracking-wide">
                {tab.label}
            </span>
        </div>
    )
}

export function BottomNav() {
    const navigate = useNavigate()
    const location = useLocation()

    const getActiveTab = () => {
        if (location.pathname.startsWith('/swap')) return 'swap'
        if (location.pathname.startsWith('/portfolio')) return 'portfolio'
        return 'swap'
    }

    const activeTab = getActiveTab()

    return (
        <nav className="nav-tabs fixed bottom-0 left-0 right-0 w-full bg-[#FFFFFF] border-t-2 border-border max-w-[430px] mx-auto z-50 shadow-lg transition-shadow duration-200" role="tablist">
            <div className="flex items-center justify-around h-16">
                {tabs.map((tab) => (
                    <NavTabButton
                        key={tab.id}
                        tab={tab}
                        isActive={activeTab === tab.id}
                        onSelect={() => {
                            navigate({ to: tab.path })
                        }}
                    />
                ))}
            </div>
        </nav>
    )
}
