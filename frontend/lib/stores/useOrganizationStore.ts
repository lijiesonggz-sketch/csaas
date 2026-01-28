/**
 * Organization Store (Zustand)
 *
 * State management for organizations and weaknesses
 * Story 1.1 - Phase 3 - Task 3.4
 *
 * @module frontend/lib/stores/useOrganizationStore
 */

import { create } from 'zustand'
import { Organization, WeaknessSnapshot, AggregatedWeakness } from '../types/organization'
import { organizationsApi } from '../api/organizations'

interface OrganizationState {
  // State
  currentOrganization: Organization | null
  organizations: Organization[]
  weaknesses: WeaknessSnapshot[]
  aggregatedWeaknesses: AggregatedWeakness[]
  loading: boolean
  error: string | null

  // Actions
  fetchOrganizations: () => Promise<void>
  setCurrentOrganization: (org: Organization | null) => void
  fetchWeaknesses: () => Promise<void>
  clearError: () => void
}

export const useOrganizationStore = create<OrganizationState>((set, get) => ({
  // Initial state
  currentOrganization: null,
  organizations: [],
  weaknesses: [],
  aggregatedWeaknesses: [],
  loading: false,
  error: null,

  /**
   * Fetch user's organizations
   */
  fetchOrganizations: async () => {
    set({ loading: true, error: null })

    try {
      const org = await organizationsApi.getUserOrganizations()

      set({ organizations: [org], loading: false })

      // Auto-set fetched organization as current if none selected
      get().setCurrentOrganization(
        get().currentOrganization || org || null,
      )
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organizations',
      })
    }
  },

  /**
   * Set current organization
   */
  setCurrentOrganization: (org: Organization | null) => {
    set({ currentOrganization: org })

    // Clear weaknesses when switching organizations
    if (org) {
      set({ weaknesses: [], aggregatedWeaknesses: [] })
    }
  },

  /**
   * Fetch weaknesses for current organization
   */
  fetchWeaknesses: async () => {
    const currentOrg = get().currentOrganization

    if (!currentOrg) {
      return
    }

    set({ loading: true, error: null })

    try {
      // Fetch both regular and aggregated weaknesses in parallel
      const [weaknesses, aggregated] = await Promise.all([
        organizationsApi.getOrganizationWeaknesses(currentOrg.id),
        organizationsApi.getAggregatedWeaknesses(currentOrg.id),
      ])

      set({
        weaknesses,
        aggregatedWeaknesses: aggregated,
        loading: false,
      })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch weaknesses',
      })
    }
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set({ error: null })
  },
}))
