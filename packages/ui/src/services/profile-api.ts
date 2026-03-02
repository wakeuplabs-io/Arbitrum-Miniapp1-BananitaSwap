/**
 * Profile API: fetch profile, upload/clear profile picture.
 */
import envParsed from '@/env-parsed'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'

const BASE = `${envParsed.API_URL}/users`

export type ProfileResponse = {
	userAddress: string
	profileImageUrl: string | null
	updatedAt: string | null
}

export type AuthHeaders = Record<string, string>

export async function getProfile(): Promise<ProfileResponse> {
	const { getAuthHeaders } = useLemonMiniapp()
	const headers = getAuthHeaders()
	const res = await fetch(`${BASE}/profile`, { headers })
	if (!res.ok) {
		throw new Error(`Failed to get profile: ${res.status} ${res.statusText}`)
	}
	return res.json() as Promise<ProfileResponse>
}

export type UploadPictureResult = { profileImageUrl: string } | { error: string }

export async function uploadProfilePicture(
	file: File,
): Promise<UploadPictureResult> {
	const { getAuthHeaders } = useLemonMiniapp()

	const headers = getAuthHeaders()
	const form = new FormData()
	form.append('picture', file)
	const res = await fetch(`${BASE}/profile/picture`, {
		method: 'POST',
		headers,
		body: form,
	})
	const json = (await res.json()) as { profileImageUrl?: string; error?: string }
	if (!res.ok) {
		return { error: json?.error ?? `${res.status} ${res.statusText}` }
	}
	if (typeof json?.profileImageUrl !== 'string') {
		return { error: 'Invalid response from server' }
	}
	return { profileImageUrl: json.profileImageUrl }
}

export async function clearProfilePicture(): Promise<{ error?: string }> {
	const { getAuthHeaders } = useLemonMiniapp()
	const headers = getAuthHeaders()
	const res = await fetch(`${BASE}/profile/picture`, { method: 'DELETE', headers })
	if (!res.ok) {
		const json = (await res.json()) as { error?: string }
		return { error: json?.error ?? `${res.status} ${res.statusText}` }
	}
	return {}
}
