import { UserRole } from '@/lib/auth/types'
import { fetchAdvisoryModuleConfig, updateAdvisoryModuleConfig } from './admin-config'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
}))

const moduleConfig = {
  id: 'config-1',
  tenantId: 'tenant-1',
  moduleKey: 'thinktank' as const,
  enabled: true,
  allowedRoles: [UserRole.ADMIN, UserRole.RESPONDENT],
  dataRetentionDays: 90,
  privacyConfirmedAt: '2026-05-19T00:00:00.000Z',
  privacyConfirmedBy: 'admin-1',
  latestAuditSummary: [],
}

describe('advisory admin config client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('unwraps nested data envelopes when loading module config', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          data: moduleConfig,
        },
      }),
    })

    await expect(fetchAdvisoryModuleConfig()).resolves.toEqual(moduleConfig)
  })

  it('unwraps nested data envelopes when saving module config', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          data: moduleConfig,
        },
      }),
    })

    await expect(
      updateAdvisoryModuleConfig({
        enabled: true,
        allowedRoles: [UserRole.ADMIN, UserRole.RESPONDENT],
        dataRetentionDays: 90,
        privacyConfirmed: true,
      })
    ).resolves.toEqual(moduleConfig)
  })
})
