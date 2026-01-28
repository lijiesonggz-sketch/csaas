import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/utils/api'

/**
 * useOnboarding Hook
 *
 * Manages Radar Service onboarding state and completion status.
 * Checks localStorage for onboarding completion flag.
 *
 * Story 1.4 - AC 2, 6: 首次访问引导和引导完成
 *
 * @param orgId - Organization ID
 * @returns Onboarding state and actions
 */
export function useOnboarding(orgId?: string | null) {
  const [isOnboarded, setIsOnboarded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [radarActivated, setRadarActivated] = useState(false)

  const ONBOARDING_STORAGE_KEY = `radar_onboarding_${orgId || 'default'}`
  const RADAR_ACTIVATED_KEY = `radar_activated_${orgId || 'default'}`

  // Check onboarding and activation status on mount
  useEffect(() => {
    // Skip on server-side
    if (typeof window === 'undefined') {
      setIsLoading(false)
      return
    }

    const checkStatus = async () => {
      setIsLoading(true)

      try {
        // Check localStorage for onboarding completion
        const onboarded = localStorage.getItem(ONBOARDING_STORAGE_KEY)
        setIsOnboarded(onboarded === 'true')

        // Check localStorage for radar activation
        const activated = localStorage.getItem(RADAR_ACTIVATED_KEY)
        setRadarActivated(activated === 'true')

        // If orgId provided, also check server
        if (orgId && activated !== 'true') {
          const response = await apiFetch(`/organizations/${orgId}/radar-status`)

          // Handle 401 Unauthorized gracefully
          if (response.status === 401) {
            console.warn('User not authenticated - skipping radar status check')
          } else if (response.ok) {
            const data = await response.json()
            setRadarActivated(data.radarActivated)
            localStorage.setItem(RADAR_ACTIVATED_KEY, String(data.radarActivated))
          }
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkStatus()
  }, [orgId])

  // Mark onboarding as complete
  const completeOnboarding = async () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
      setIsOnboarded(true)
      return true
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
      return false
    }
  }

  // Reset onboarding (for testing purposes)
  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY)
    setIsOnboarded(false)
  }

  return {
    isOnboarded,
    radarActivated,
    isLoading,
    completeOnboarding,
    resetOnboarding,
  }
}
