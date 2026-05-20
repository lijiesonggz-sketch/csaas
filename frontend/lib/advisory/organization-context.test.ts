import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import {
  ORGANIZATION_CONTEXT_NAME_REQUIRED_MESSAGE,
  ORGANIZATION_CONTEXT_NAME_TOO_LONG_MESSAGE,
  fetchOrganizationContext,
  readOrganizationContextSkip,
  saveOrganizationContext,
  writeOrganizationContextSkip,
} from './organization-context'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>
const mockFetch = jest.fn()

describe('organization context client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.sessionStorage.clear()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  it('loads first-use organization context through the frontend proxy', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          context: null,
          completenessScore: 0,
          completeness: {
            requiredFieldsComplete: false,
            missingFields: ['organizationName', 'industry', 'size'],
            updatedAt: null,
          },
          appliedToPrompts: false,
        },
      }),
    })

    await expect(fetchOrganizationContext()).resolves.toEqual({
      context: null,
      completenessScore: 0,
      completeness: {
        requiredFieldsComplete: false,
        missingFields: ['organizationName', 'industry', 'size'],
        updatedAt: null,
      },
      appliedToPrompts: false,
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/organization-context', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer session-token',
      },
      cache: 'no-store',
    })
  })

  it('validates required and over-limit organization names before save calls', async () => {
    await expect(saveOrganizationContext({ organizationName: '   ' })).rejects.toThrow(
      ORGANIZATION_CONTEXT_NAME_REQUIRED_MESSAGE
    )
    await expect(saveOrganizationContext({ organizationName: '\u200b\u200c' })).rejects.toThrow(
      ORGANIZATION_CONTEXT_NAME_REQUIRED_MESSAGE
    )
    await expect(saveOrganizationContext({ organizationName: 'A'.repeat(501) })).rejects.toThrow(
      ORGANIZATION_CONTEXT_NAME_TOO_LONG_MESSAGE
    )

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('saves only whitelisted organization fields and trims optional values', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'context-1',
          organizationName: 'Tenant A Security Group',
          industry: 'Data security',
          size: null,
          completenessScore: 67,
          completeness: {
            requiredFieldsComplete: true,
            missingFields: ['size'],
            updatedAt: '2026-05-20T15:33:04.000Z',
          },
          appliedToPrompts: false,
        },
      }),
    })

    await expect(
      saveOrganizationContext({
        organizationName: '  Tenant\nA\u200b Security\tGroup  ',
        industry: '  Data\nsecurity  ',
        size: '\u200b\u200c',
        tenantId: 'attacker-tenant',
        contextType: 'attacker-context',
      } as never)
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'context-1',
        organizationName: 'Tenant A Security Group',
        industry: 'Data security',
        size: null,
        completenessScore: 67,
      })
    )
    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/organization-context', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organizationName: 'Tenant A Security Group',
        industry: 'Data security',
      }),
      cache: 'no-store',
    })
    expect(mockFetch.mock.calls[0][1].body).not.toContain('attacker-tenant')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('attacker-context')
  })

  it('stores skip state in session storage only for the current user identity', () => {
    expect(readOrganizationContextSkip('user-1')).toBe(false)

    writeOrganizationContextSkip('user-1')

    expect(readOrganizationContextSkip('user-1')).toBe(true)
    expect(readOrganizationContextSkip('user-2')).toBe(false)
    expect(window.sessionStorage.length).toBe(1)
  })
})
