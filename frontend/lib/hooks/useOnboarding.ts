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

        try {
          const data = await apiFetch(`/organizations/${orgId}/radar-status`)
          console.log('[useOnboarding] Radar status data:', data)

          // apiFetch 已经自动提取了 result.data，所以 data 就是 status 数据
          const radarActivated = data?.radarActivated ?? false
          console.log('[useOnboarding] Extracted radarActivated:', radarActivated)
          setRadarActivated(radarActivated)
          localStorage.setItem(RADAR_ACTIVATED_KEY, String(radarActivated))
        } catch (error: any) {
          // Handle API errors
          console.warn('[useOnboarding] API Error:', error.message)

          // 如果是404或403，使用localStorage fallback
          if (error.message?.includes('404') || error.message?.includes('403')) {
            console.log('[useOnboarding] Using localStorage fallback')
            activated = localStorage.getItem(RADAR_ACTIVATED_KEY)
            setRadarActivated(activated === 'true')
          } else {
            throw error
          }
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
