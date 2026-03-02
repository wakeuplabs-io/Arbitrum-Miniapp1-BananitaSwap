import { useState, useEffect, useCallback } from 'react'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
import { getProfile, uploadProfilePicture, clearProfilePicture } from '@/services/profile-api'

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function useUserProfile() {
	const { getAuthHeaders, isAuthenticated } = useLemonMiniapp()
	const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null)

	const loadProfile = useCallback(async () => {
		try {
			const profile = await getProfile()
			setAvatarDataUrl(profile.profileImageUrl ?? null)
		} catch {
			setAvatarDataUrl(null)
		}
	}, [getAuthHeaders])

	useEffect(() => {
		if (!isAuthenticated) {
			setAvatarDataUrl(null)
			return
		}
		loadProfile()
	}, [isAuthenticated, loadProfile])

	const setAvatarFromFile = useCallback(
		async (file: File): Promise<{ success: boolean; error?: string }> => {
			if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
				return { success: false, error: 'Please choose a JPEG, PNG, WebP or GIF image.' }
			}
			if (file.size > MAX_AVATAR_SIZE_BYTES) {
				return { success: false, error: 'Image must be under 5MB.' }
			}
			const headers = getAuthHeaders()
			if (!Object.keys(headers).length) {
				return { success: false, error: 'You must be signed in to change your photo.' }
			}
			const result = await uploadProfilePicture(file)
			if ('error' in result) {
				return { success: false, error: result.error }
			}
			setAvatarDataUrl(result.profileImageUrl)
			return { success: true }
		},
		[getAuthHeaders]
	)

	const clearAvatar = useCallback(async () => {
		await clearProfilePicture()
		setAvatarDataUrl(null)
	}, [getAuthHeaders])

	return {
		avatarDataUrl,
		setAvatarFromFile,
		clearAvatar,
	}
}
