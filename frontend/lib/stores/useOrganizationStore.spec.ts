import { renderHook, act } from '@testing-library/react'
import { waitFor } from '@testing-library/dom'
import { describe, expect, it, beforeEach, jest } from '@jest/globals'

// Mock the organizations API
jest.mock('../api/organizations', () => ({
  organizationsApi: {
    getUserOrganizations: jest.fn(),
    getOrganizationById: jest.fn(),
    getOrganizationStats: jest.fn(),
    getOrganizationWeaknesses: jest.fn(),
    getAggregatedWeaknesses: jest.fn(),
  },
}))

import { useOrganizationStore } from './useOrganizationStore'

describe('useOrganizationStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset zustand store state between tests
    useOrganizationStore.setState({
      currentOrganization: null,
      organizations: [],
      weaknesses: [],
      aggregatedWeaknesses: [],
      loading: false,
      error: null,
    })
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useOrganizationStore())

      expect(result.current).toMatchObject({
        currentOrganization: null,
        organizations: [],
        weaknesses: [],
        aggregatedWeaknesses: [],
        loading: false,
        error: null,
      })
    })
  })

  describe('fetchOrganizations', () => {
    it('should fetch and set organizations', async () => {
      // Arrange
      const mockOrg = {
        id: 'org-123',
        name: 'Test Organization',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }

      const { organizationsApi } = require('../api/organizations')
      organizationsApi.getUserOrganizations.mockResolvedValue(mockOrg)

      const { result } = renderHook(() => useOrganizationStore())

      // Act
      await act(async () => {
        await result.current.fetchOrganizations()
      })

      // Assert
      expect(result.current.organizations).toEqual([mockOrg])
      expect(result.current.currentOrganization).toEqual(mockOrg)
      expect(result.current.loading).toBe(false)
    })

    it('should set error on fetch failure', async () => {
      // Arrange
      const { organizationsApi } = require('../api/organizations')
      organizationsApi.getUserOrganizations.mockRejectedValue(new Error('API Error'))

      const { result } = renderHook(() => useOrganizationStore())

      // Act
      await act(async () => {
        await result.current.fetchOrganizations()
      })

      // Assert
      expect(result.current.error).toBe('API Error')
      expect(result.current.loading).toBe(false)
    })
  })

  describe('setCurrentOrganization', () => {
    it('should set current organization', () => {
      const { result } = renderHook(() => useOrganizationStore())
      const mockOrg = {
        id: 'org-123',
        name: 'Test Org',
      } as any

      act(() => {
        result.current.setCurrentOrganization(mockOrg)
      })

      expect(result.current.currentOrganization).toEqual(mockOrg)
    })

    it('should clear current organization when null is passed', () => {
      const { result } = renderHook(() => useOrganizationStore())

      // First set an org
      act(() => {
        result.current.setCurrentOrganization({
          id: 'org-123',
          name: 'Test Org',
        } as any)
      })

      expect(result.current.currentOrganization).toBeDefined()

      // Clear it
      act(() => {
        result.current.setCurrentOrganization(null)
      })

      expect(result.current.currentOrganization).toBeNull()
    })

    it('should clear weaknesses and aggregated weaknesses when setting new organization', () => {
      const { result } = renderHook(() => useOrganizationStore())

      // First set an org and add some weaknesses
      act(() => {
        result.current.setCurrentOrganization({
          id: 'org-123',
          name: 'Test Org',
        } as any)
      })

      // Set a new organization - weaknesses should be cleared
      act(() => {
        result.current.setCurrentOrganization({
          id: 'org-456',
          name: 'New Org',
        } as any)
      })

      expect(result.current.weaknesses).toEqual([])
      expect(result.current.aggregatedWeaknesses).toEqual([])
    })
  })

  describe('fetchWeaknesses', () => {
    it('should fetch weaknesses for current organization', async () => {
      // Arrange
      const mockWeaknesses = [
        {
          id: 'snap-123',
          category: 'data_security',
          level: 2,
          description: 'Weak security',
          projectIds: ['p1'],
        },
      ]

      const mockAggregatedWeaknesses = [
        {
          category: 'data_security',
          level: 2,
          description: 'Weak security',
          projectIds: ['p1', 'p2'],
        },
      ]

      const { organizationsApi } = require('../api/organizations')
      organizationsApi.getOrganizationWeaknesses.mockResolvedValue(mockWeaknesses)
      organizationsApi.getAggregatedWeaknesses.mockResolvedValue(mockAggregatedWeaknesses)

      const { result } = renderHook(() => useOrganizationStore())

      // First set current org
      act(() => {
        result.current.setCurrentOrganization({ id: 'org-123' } as any)
      })

      // Act
      await act(async () => {
        await result.current.fetchWeaknesses()
      })

      // Assert
      expect(result.current.weaknesses).toEqual(mockWeaknesses)
      expect(result.current.aggregatedWeaknesses).toEqual(mockAggregatedWeaknesses)
    })

    it('should not fetch if no current organization', async () => {
      const { result } = renderHook(() => useOrganizationStore())

      await act(async () => {
        await result.current.fetchWeaknesses()
      })

      expect(require('../api/organizations').organizationsApi.getOrganizationWeaknesses).not.toHaveBeenCalled()
    })
  })

  describe('clearError', () => {
    it('should clear error state', () => {
      const { result } = renderHook(() => useOrganizationStore())

      // Set an error
      act(() => {
        result.current.error = 'Test error'
      })

      expect(result.current.error).toBe('Test error')

      // Clear it
      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})
