import { describe, expect, it, beforeEach, jest } from '@jest/globals'
import { OrganizationsApi } from './organizations'

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<any, Promise<Response>>

describe('OrganizationsApi', () => {
  let api: OrganizationsApi

  beforeEach(() => {
    api = new OrganizationsApi()
    jest.clearAllMocks()
  })

  describe('getUserOrganizations', () => {
    it('should fetch user organizations successfully', async () => {
      // Arrange
      const mockOrgs = [
        {
          id: 'org-123',
          name: 'Test Organization',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]

      ;(global.fetch as jest.MockedFunction<any, Promise<Response>>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockOrgs }),
      } as Response)

      // Act
      const result = await api.getUserOrganizations()

      // Assert
      expect(result).toEqual(mockOrgs)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/organizations/me'),
        expect.any(Object),
      )
    })

    it('should throw error on failure', async () => {
      // Arrange
      ;(global.fetch as jest.MockedFunction<any, Promise<Response>>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Unauthorized' }),
      } as Response)

      // Act & Assert
      await expect(api.getUserOrganizations()).rejects.toThrow('Unauthorized')
    })
  })

  describe('getOrganizationWeaknesses', () => {
    it('should fetch weaknesses for an organization', async () => {
      // Arrange
      const mockWeaknesses = [
        {
          id: 'snap-123',
          category: 'data_security',
          level: 2,
          description: 'Data security weakness',
          projectIds: ['project-1'],
        },
      ]

      ;(global.fetch as jest.MockedFunction<any, Promise<Response>>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockWeaknesses }),
      } as Response)

      // Act
      const result = await api.getOrganizationWeaknesses('org-123')

      // Assert
      expect(result).toEqual(mockWeaknesses)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/organizations/org-123/weaknesses'),
        expect.any(Object),
      )
    })
  })

  describe('getAggregatedWeaknesses', () => {
    it('should fetch aggregated weaknesses', async () => {
      // Arrange
      const mockAggregated = [
        {
          category: 'data_security',
          level: 2,
          description: 'Weak security',
          projectIds: ['p1', 'p2'],
        },
      ]

      ;(global.fetch as jest.MockedFunction<any, Promise<Response>>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAggregated }),
      } as Response)

      // Act
      const result = await api.getAggregatedWeaknesses('org-123')

      // Assert
      expect(result).toEqual(mockAggregated)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/organizations/org-123/weaknesses/aggregated'),
        expect.any(Object),
      )
    })
  })

  describe('getOrganizationProjects', () => {
    it('should fetch paginated projects', async () => {
      // Arrange
      const mockResponse = {
        data: [{ id: 'project-1', name: 'Project 1' }],
        pagination: { page: 1, limit: 10, total: 25, totalPages: 3 },
      }

      ;(global.fetch as jest.MockedFunction<any, Promise<Response>>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse }),
      } as Response)

      // Act
      const result = await api.getOrganizationProjects('org-123', 1, 10)

      // Assert
      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(25)
    })
  })
})
