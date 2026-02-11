import { OrganizationsApi } from '../organizations'

// Mock apiFetch
jest.mock('../../utils/api', () => ({
  apiFetch: jest.fn(),
}))

const { apiFetch } = require('../../utils/api')

describe('OrganizationsApi - Story 1.5 Methods', () => {
  let api: OrganizationsApi

  beforeEach(() => {
    jest.clearAllMocks()
    api = new OrganizationsApi()
  })

  describe('getOrganizationMembers', () => {
    it('should fetch members with default pagination', async () => {
      const mockResponse = {
        data: [{ id: 'member-1', userId: 'user-1', role: 'admin' }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }
      apiFetch.mockResolvedValue(mockResponse)

      const result = await api.getOrganizationMembers('org-1')

      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/organizations/org-1/members'),
      )
      expect(result).toEqual(mockResponse)
    })

    it('should pass custom page and limit params', async () => {
      apiFetch.mockResolvedValue({ data: [], pagination: {} })

      await api.getOrganizationMembers('org-1', 2, 20)

      const calledUrl = apiFetch.mock.calls[0][0]
      expect(calledUrl).toContain('page=2')
      expect(calledUrl).toContain('limit=20')
    })
  })

  describe('addMember', () => {
    it('should call POST with userId and role', async () => {
      apiFetch.mockResolvedValue({ id: 'member-new' })

      await api.addMember('org-1', 'user-123', 'member')

      expect(apiFetch).toHaveBeenCalledWith('/organizations/org-1/members', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user-123', role: 'member' }),
      })
    })

    it('should default role to member', async () => {
      apiFetch.mockResolvedValue({ id: 'member-new' })

      await api.addMember('org-1', 'user-123')

      expect(apiFetch).toHaveBeenCalledWith('/organizations/org-1/members', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user-123', role: 'member' }),
      })
    })
  })
  describe('removeMember', () => {
    it('should call DELETE with correct URL', async () => {
      apiFetch.mockResolvedValue(undefined)

      await api.removeMember('org-1', 'user-123')

      expect(apiFetch).toHaveBeenCalledWith('/organizations/org-1/members/user-123', {
        method: 'DELETE',
      })
    })
  })

  describe('updateMemberRole', () => {
    it('should call PATCH with role in body', async () => {
      apiFetch.mockResolvedValue({ id: 'member-1', role: 'admin' })

      const result = await api.updateMemberRole('org-1', 'user-123', 'admin')

      expect(apiFetch).toHaveBeenCalledWith('/organizations/org-1/members/user-123', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'admin' }),
      })
      expect(result.role).toBe('admin')
    })
  })

  describe('lookupUserByEmail', () => {
    it('should call GET with encoded email', async () => {
      const mockUser = { id: 'user-1', name: 'Test', email: 'test@example.com' }
      apiFetch.mockResolvedValue(mockUser)

      const result = await api.lookupUserByEmail('test@example.com')

      expect(apiFetch).toHaveBeenCalledWith(
        '/organizations/users/lookup?email=test%40example.com',
      )
      expect(result).toEqual(mockUser)
    })
  })

  describe('addMemberByEmail', () => {
    it('should lookup user then add member', async () => {
      const mockUser = { id: 'user-found', name: 'Found', email: 'found@example.com' }
      apiFetch
        .mockResolvedValueOnce(mockUser) // lookupUserByEmail
        .mockResolvedValueOnce({ id: 'member-new' }) // addMember POST

      const result = await api.addMemberByEmail('org-1', 'found@example.com', 'admin')

      // First call: lookup
      expect(apiFetch).toHaveBeenNthCalledWith(
        1,
        '/organizations/users/lookup?email=found%40example.com',
      )
      // Second call: add member
      expect(apiFetch).toHaveBeenNthCalledWith(2, '/organizations/org-1/members', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user-found', role: 'admin' }),
      })
    })

    it('should propagate error if user lookup fails', async () => {
      apiFetch.mockRejectedValue(new Error('找不到该用户，请检查邮箱地址'))

      await expect(
        api.addMemberByEmail('org-1', 'nonexistent@example.com', 'member'),
      ).rejects.toThrow('找不到该用户，请检查邮箱地址')
    })
  })
})
