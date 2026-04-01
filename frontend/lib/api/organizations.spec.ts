import { describe, expect, it, beforeEach, jest } from '@jest/globals'
import { OrganizationsApi } from './organizations'

// Mock apiFetch to avoid auth/fetch issues
jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
}))

import { apiFetch } from '../utils/api'

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

describe('OrganizationsApi', () => {
  let api: OrganizationsApi

  beforeEach(() => {
    api = new OrganizationsApi()
    jest.clearAllMocks()
  })

  describe('getUserOrganizations', () => {
    it('should fetch user organization successfully', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Test Organization',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }

      mockApiFetch.mockResolvedValueOnce({ organization: mockOrg } as any)

      const result = await api.getUserOrganizations()

      expect(result).toEqual(mockOrg)
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/organizations/me'),
      )
    })

    it('should throw error on failure', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Unauthorized'))

      await expect(api.getUserOrganizations()).rejects.toThrow()
    })
  })

  describe('getOrganizationWeaknesses', () => {
    it('should fetch weaknesses for an organization', async () => {
      const mockWeaknesses = [
        {
          id: 'snap-123',
          category: 'data_security',
          level: 2,
          description: 'Data security weakness',
          projectIds: ['project-1'],
        },
      ]

      mockApiFetch.mockResolvedValueOnce(mockWeaknesses as any)

      const result = await api.getOrganizationWeaknesses('org-123')

      expect(result).toEqual(mockWeaknesses)
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/organizations/org-123/weaknesses'),
      )
    })
  })

  describe('getAggregatedWeaknesses', () => {
    it('should fetch aggregated weaknesses', async () => {
      const mockAggregated = [
        {
          category: 'data_security',
          level: 2,
          description: 'Weak security',
          projectIds: ['p1', 'p2'],
        },
      ]

      mockApiFetch.mockResolvedValueOnce(mockAggregated as any)

      const result = await api.getAggregatedWeaknesses('org-123')

      expect(result).toEqual(mockAggregated)
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/organizations/org-123/weaknesses/aggregated'),
      )
    })
  })

  describe('getOrganizationProjects', () => {
    it('should fetch paginated projects', async () => {
      const mockResponse = {
        data: [{ id: 'project-1', name: 'Project 1' }],
        pagination: { page: 1, limit: 10, total: 25, totalPages: 3 },
      }

      mockApiFetch.mockResolvedValueOnce(mockResponse as any)

      const result = await api.getOrganizationProjects('org-123', 1, 10)

      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(25)
    })
  })

  describe('getOrganizationStats', () => {
    it('should fetch organization statistics', async () => {
      const mockStats = {
        id: 'org-123',
        memberCount: 5,
        projectCount: 10,
        weaknessSnapshotCount: 3,
      }

      mockApiFetch.mockResolvedValueOnce(mockStats as any)

      const result = await api.getOrganizationStats('org-123')

      expect(result.memberCount).toBe(5)
      expect(result.projectCount).toBe(10)
    })
  })
})
