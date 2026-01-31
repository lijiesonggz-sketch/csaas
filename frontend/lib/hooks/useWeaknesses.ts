import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/utils/api'

export interface WeaknessCategory {
  name: string
  level: number
  count: number
}

/**
 * useWeaknesses Hook
 *
 * Fetches and manages weakness data for an organization.
 * Used in Onboarding Wizard Step 1 to display identified weaknesses.
 *
 * Story 1.4 - AC 3: 引导步骤1 - 薄弱项识别
 *
 * @param orgId - Organization ID
 * @param projectId - Optional project ID to filter weaknesses
 * @returns Weakness data and loading state
 */
export function useWeaknesses(orgId?: string | null, projectId?: string | null) {
  const [weaknesses, setWeaknesses] = useState<WeaknessCategory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) return

    const fetchWeaknesses = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch aggregated weaknesses from the backend
        const endpoint = projectId
          ? `/organizations/${orgId}/weaknesses/aggregated?projectId=${projectId}`
          : `/organizations/${orgId}/weaknesses/aggregated`

        const response = await apiFetch(endpoint)

        // Handle 401 Unauthorized gracefully
        if (response.status === 401) {
          console.warn('User not authenticated - skipping weaknesses fetch')
          setWeaknesses([])
          setIsLoading(false)
          return
        }

        // Handle 404 Not Found gracefully (no data yet)
        if (response.status === 404) {
          console.info('No weaknesses data found for organization')
          setWeaknesses([])
          setIsLoading(false)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch weaknesses')
        }

        const data = await response.json()
        console.log('[useWeaknesses] API response data:', data)

        // Transform data into WeaknessCategory format
        // The API returns aggregated weaknesses by category
        const categories: WeaknessCategory[] = Object.entries(
          data.byCategory || {},
        ).map(([name, info]: [string, any]) => ({
          name,
          level: info.averageLevel || 0,
          count: info.count || 0,
        }))

        // Sort by level (highest first)
        categories.sort((a, b) => b.level - a.level)

        setWeaknesses(categories)
      } catch (err) {
        console.error('Failed to fetch weaknesses:', err)
        console.error('Error details:', {
          message: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined,
        })
        setError(err instanceof Error ? err.message : 'Unknown error')
        setWeaknesses([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchWeaknesses()
  }, [orgId, projectId])

  return {
    weaknesses,
    isLoading,
    error,
    hasData: weaknesses.length > 0,
  }
}
