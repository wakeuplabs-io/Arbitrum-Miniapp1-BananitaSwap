import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY_NAME = 'user-profile-display-name'
const STORAGE_KEY_AVATAR = 'user-profile-avatar-data-url'
const DEFAULT_DISPLAY_NAME = 'bananauser'
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

function getStoredDisplayName(): string {
	if (typeof window === 'undefined') return DEFAULT_DISPLAY_NAME
	const stored = localStorage.getItem(STORAGE_KEY_NAME)
	return stored ?? DEFAULT_DISPLAY_NAME
}

function getStoredAvatar(): string | null {
	if (typeof window === 'undefined') return null
	return localStorage.getItem(STORAGE_KEY_AVATAR)
}

/**
 * Normalizes a display name for storage (no leading @).
 * Returns value suitable for display (with @ prefix).
 */
export function normalizeDisplayName(value: string): string {
	const trimmed = value.trim().replace(/^@+/, '')
	return trimmed || DEFAULT_DISPLAY_NAME
}

export function formatDisplayForShow(name: string): string {
	const n = name.trim()
	if (!n) return `@${DEFAULT_DISPLAY_NAME}`
	return n.startsWith('@') ? n : `@${n}`
}

export function getInitialFromDisplayName(name: string): string {
	const normalized = normalizeDisplayName(name)
	if (!normalized) return 'G'
	return normalized.charAt(0).toUpperCase()
}

export type UserProfile = {
	displayName: string
	displayNameFormatted: string
	initial: string
	avatarDataUrl: string | null
	setDisplayName: (name: string) => void
	setAvatar: (dataUrl: string | null) => void
	setAvatarFromFile: (file: File) => Promise<{ success: boolean; error?: string }>
	clearAvatar: () => void
}

export function useUserProfile(): UserProfile {
	const [displayName, setDisplayNameState] = useState(getStoredDisplayName)
	const [avatarDataUrl, setAvatarDataUrlState] = useState<string | null>(getStoredAvatar)

	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY_NAME)
		if (stored !== displayName) {
			localStorage.setItem(STORAGE_KEY_NAME, displayName)
		}
	}, [displayName])

	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY_AVATAR)
		if (avatarDataUrl === null) {
			if (stored !== null) {
				localStorage.removeItem(STORAGE_KEY_AVATAR)
			}
		} else {
			if (stored !== avatarDataUrl) {
				localStorage.setItem(STORAGE_KEY_AVATAR, avatarDataUrl)
			}
		}
	}, [avatarDataUrl])

	const setDisplayName = useCallback((name: string) => {
		setDisplayNameState(normalizeDisplayName(name))
	}, [])

	const setAvatar = useCallback((dataUrl: string | null) => {
		setAvatarDataUrlState(dataUrl)
	}, [])

	const clearAvatar = useCallback(() => {
		setAvatarDataUrlState(null)
	}, [])

	const setAvatarFromFile = useCallback(
		(file: File): Promise<{ success: boolean; error?: string }> => {
			if (!file.type.startsWith('image/')) {
				return Promise.resolve({ success: false, error: 'Only images are allowed' })
			}
			if (file.size > MAX_AVATAR_BYTES) {
				return Promise.resolve({
					success: false,
					error: 'Image must not exceed 2 MB',
				})
			}
			return new Promise((resolve) => {
				const reader = new FileReader()
				reader.onload = () => {
					const result = reader.result
					if (typeof result === 'string') {
						setAvatarDataUrlState(result)
						resolve({ success: true })
					} else {
						resolve({ success: false, error: 'Error reading image' })
					}
				}
				reader.onerror = () => resolve({ success: false, error: 'Error reading file' })
				reader.readAsDataURL(file)
			})
		},
		[]
	)

	const displayNameFormatted = formatDisplayForShow(displayName)
	const initial = getInitialFromDisplayName(displayName)

	return {
		displayName,
		displayNameFormatted,
		initial,
		avatarDataUrl,
		setDisplayName,
		setAvatar,
		setAvatarFromFile,
		clearAvatar,
	}
}
