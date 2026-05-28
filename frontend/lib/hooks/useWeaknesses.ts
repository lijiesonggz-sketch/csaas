import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/utils/api'

export interface WeaknessCategory {
  name: string
  level: number
  count: number
}

interface AggregatedWeaknessInfo {
  averageLevel?: number
  count?: number
}

interface AggregatedWeaknessPayload {
  byCategory?: Record<string, AggregatedWeaknessInfo>
  data?: {
    byCategory?: Record<string, AggregatedWeaknessInfo>
  }
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
  }

  return undefined
}

function toWeaknessCategories(payload: unknown): WeaknessCategory[] {
  const data = payload as AggregatedWeaknessPayload | null
  const byCategory = data?.byCategory || data?.data?.byCategory || {}

  return Object.entries(byCategory)
    .map(([name, info]) => ({
      name,
      level: info.averageLevel || 0,
      count: info.count || 0,
    }))
    .sort((a, b) => b.level - a.level)
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

        const data = await apiFetch(endpoint)
        console.log('[useWeaknesses] API response data:', data)

        setWeaknesses(toWeaknessCategories(data))
      } catch (err) {
        const status = getErrorStatus(err)

        if (status === 401) {
          console.warn('User not authenticated - skipping weaknesses fetch')
          setError(null)
          setWeaknesses([])
          return
        }

        if (status === 404) {
          console.info('No weaknesses data found for organization')
          setError(null)
          setWeaknesses([])
          return
        }

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
