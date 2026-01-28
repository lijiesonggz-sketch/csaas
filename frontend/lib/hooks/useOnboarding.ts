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
  const checkStatus = async (forceServerCheck = false) => {
    // Skip on server-side
    if (typeof window === 'undefined') {
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      // Check localStorage for onboarding completion
      const onboarded = localStorage.getItem(ONBOARDING_STORAGE_KEY)
      setIsOnboarded(onboarded === 'true')

      // Check localStorage for radar activation
      let activated = localStorage.getItem(RADAR_ACTIVATED_KEY)

      // If orgId provided, also check server
      if (orgId && (forceServerCheck || activated !== 'true')) {
        console.log(`[useOnboarding] Fetching radar status for org ${orgId}, forceServerCheck=${forceServerCheck}`)
        const response = await apiFetch(`/organizations/${orgId}/radar-status`)

        console.log(`[useOnboarding] Radar status response:`, response.status, response.ok)

        // Handle 401 Unauthorized gracefully
        if (response.status === 401) {
          console.warn('[useOnboarding] User not authenticated - skipping radar status check')
        } else if (response.status === 403) {
          console.warn('[useOnboarding] User not authorized (not a member) - using localStorage')
          // Re-read from localStorage in case it was just updated
          activated = localStorage.getItem(RADAR_ACTIVATED_KEY)
          console.log('[useOnboarding] Re-read from localStorage:', activated)
          setRadarActivated(activated === 'true')
        } else if (response.ok) {
          const data = await response.json()
          console.log('[useOnboarding] Radar status data:', data)
          // Handle both direct response and wrapped response
          const radarActivated = data.data?.radarActivated ?? data.radarActivated ?? false
          console.log('[useOnboarding] Extracted radarActivated:', radarActivated)
          setRadarActivated(radarActivated)
          localStorage.setItem(RADAR_ACTIVATED_KEY, String(radarActivated))
        } else {
          console.warn('[useOnboarding] Server check failed, using localStorage')
          // Re-read from localStorage in case it was just updated
          activated = localStorage.getItem(RADAR_ACTIVATED_KEY)
          console.log('[useOnboarding] Re-read from localStorage:', activated)
          // Fallback to localStorage if server check fails
          setRadarActivated(activated === 'true')
        }
      } else {
        console.log('[useOnboarding] Using localStorage for radar activation status:', activated)
        setRadarActivated(activated === 'true')
      }
    } catch (error) {
      console.error('[useOnboarding] Failed to check onboarding status:', error)
      // Fallback to localStorage on error
      const activated = localStorage.getItem(RADAR_ACTIVATED_KEY)
      console.log('[useOnboarding] Error - using localStorage:', activated)
      setRadarActivated(activated === 'true')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
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

  // Refetch status from server
  const refetch = () => checkStatus(true)

  return {
    isOnboarded,
    radarActivated,
    isLoading,
    completeOnboarding,
    resetOnboarding,
    refetch,
  }
}
