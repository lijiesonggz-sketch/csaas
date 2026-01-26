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
    getAggregatedWeaknesses: jest(),
  },
}))

import { useOrganizationStore } from './useOrganizationStore'

describe('useOrganizationStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useOrganizationStore())

      expect(result.current).toEqual({
        currentOrganization: null,
        organizations: [],
        weaknesses: [],
        loading: false,
        error: null,
      })
    })
  })

  describe('fetchOrganizations', () => {
    it('should fetch and set organizations', async () => {
      // Arrange
      const mockOrgs = [
        {
          id: 'org-123',
          name: 'Test Organization',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]

      const { organizationsApi } = require('../api/organizations')
      organizationsApi.getUserOrganizations.mockResolvedValue(mockOrgs)

      const { result } = renderHook(() => useOrganizationStore())

      // Act
      await act(async () => {
        await result.current.fetchOrganizations()
      })

      // Assert
      expect(result.current.organizations).toEqual(mockOrgs)
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

      const { organizationsApi } = require('../api/organizations')
      organizationsApi.getOrganizationWeaknesses.mockResolvedValue(mockWeaknesses)

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
    })

    it('should not fetch if no current organization', async () => {
      const { result } = renderHook(() => useOrganizationStore())

      await act(async () => {
        await result.current.fetchWeaknesses()
      })

      expect(require('../api/organizations').getOrganizationWeaknesses).not.toHaveBeenCalled()
    })
  })
})
