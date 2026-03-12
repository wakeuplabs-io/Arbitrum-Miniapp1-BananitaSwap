import { useState, useRef, useCallback } from 'react'
import { X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UserProfile } from '@/hooks/use-user-profile'

type PortfolioHeaderProps = {
	lemonTag?: string | undefined
	balanceUsd: number
	dailyChangePercent: number
	isLoading?: boolean
	profile: UserProfile
	onOpenDeposit: () => void
}

export function PortfolioHeader({
	lemonTag,
	balanceUsd,
	dailyChangePercent,
	isLoading,
	profile,
	onOpenDeposit,
}: PortfolioHeaderProps) {
	const [avatarError, setAvatarError] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const handleAvatarClick = useCallback(() => {
		setAvatarError(null)
		fileInputRef.current?.click()
	}, [])

	const handleAvatarFileChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0]
			e.target.value = ''
			if (!file) return
			const result = await profile.setAvatarFromFile(file)
			if (result.success) {
				setAvatarError(null)
			} else {
				setAvatarError(result.error ?? 'Error uploading image')
			}
		},
		[profile]
	)

	const handleRemoveAvatar = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			profile.clearAvatar()
			setAvatarError(null)
		},
		[profile]
	)

	return (
		<div className="flex flex-col items-center gap-3 pt-8 pb-4 animate-fade-in-up">
			<div className="relative">
				<button
					type="button"
					onClick={handleAvatarClick}
					aria-label="Change profile photo"
					className="avatar-interactive flex h-20 w-20 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-shadow"
				>
					<div
						className={`flex items-center justify-center rounded-full overflow-hidden ${
							profile.avatarDataUrl ? 'h-[4.25rem] w-[4.25rem] border border-border bg-card' : 'h-full w-full'
						}`}
					>
						{profile.avatarDataUrl ? (
							<img src={profile.avatarDataUrl} alt="" className="h-full w-full object-cover" />
						) : (
							<img
								src="/avatar-empty-state.webp"
								alt=""
								className="h-full w-full object-cover object-center scale-110"
							/>
						)}
					</div>
				</button>
				<button
					type="button"
					onClick={handleAvatarClick}
					aria-label="Change profile photo"
					className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
				>
					<Pencil className="h-3 w-3" strokeWidth={2.5} />
				</button>
				{profile.avatarDataUrl && (
					<button
						type="button"
						onClick={handleRemoveAvatar}
						aria-label="Remove profile photo"
						className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
					>
						<X className="h-3.5 w-3.5" strokeWidth={2.5} />
					</button>
				)}
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					className="sr-only"
					aria-hidden
					onChange={handleAvatarFileChange}
				/>
			</div>
			{avatarError && (
				<p className="text-xs text-destructive text-center max-w-[240px]">{avatarError}</p>
			)}
			{lemonTag && (
				<span className="text-xs text-muted-foreground">@{lemonTag}</span>
			)}
			<div className="flex flex-col items-center gap-0.5">
				<p className="text-xs font-display font-medium tracking-wide uppercase text-muted-foreground">
					Total value in USDC
				</p>
				{isLoading ? (
					<>
						<div className="h-12 w-32 bg-muted rounded animate-pulse" aria-hidden />
						<div className="h-4 w-20 bg-muted rounded animate-pulse mt-2" aria-hidden />
					</>
				) : (
					<>
						<p className="text-5xl text-foreground tracking-tight numeric-balance">${balanceUsd.toFixed(2)}</p>
						{balanceUsd === 0 ? (
							<Button
								type="button"
								variant="default"
								size="xs"
								onClick={onOpenDeposit}
								className="mt-1 rounded-full !bg-black hover:!bg-gray-900 !text-white !border-0 focus-visible:!ring-2 focus-visible:!ring-white focus-visible:!ring-offset-2"
							>
								Deposit to get started
							</Button>
						) : (
							<p className="flex items-center gap-1 text-sm text-muted-foreground">
								<span className={dailyChangePercent >= 0 ? 'text-success' : 'text-destructive'}>
									{dailyChangePercent >= 0 ? '▲' : '▼'}
								</span>
								{`${Math.abs(dailyChangePercent).toFixed(1)}% 24h`}
							</p>
						)}
					</>
				)}
			</div>
		</div>
	)
}
