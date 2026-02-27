import { useState, useEffect } from 'react'

const AVATAR_POOL_SIZE = 1
const STORAGE_KEY = 'user-avatar-index'

/**
 * Hook to manage user avatar selection from a pool of images
 * Randomly assigns an avatar on first use and persists it in localStorage
 * @returns The avatar image URL
 */
export function useAvatar() {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

    useEffect(() => {
        // Try to get saved avatar from localStorage
        const savedIndex = localStorage.getItem(STORAGE_KEY)

        if (savedIndex !== null) {
            // Use saved avatar
            const index = parseInt(savedIndex, 10)
            if (index >= 1 && index <= AVATAR_POOL_SIZE) {
                setAvatarUrl(`/avatar-${index}.webp`)
                return
            }
        }

        // Generate random avatar index (1-10)
        const randomIndex = Math.floor(Math.random() * AVATAR_POOL_SIZE) + 1

        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, randomIndex.toString())

        // Set avatar URL
        setAvatarUrl(`/avatar-${randomIndex}.webp`)
    }, [])

    return avatarUrl
}
