import { AuditAction } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { AdvisoryAccessService } from './advisory-access.service'

describe('AdvisoryAccessService', () => {
  let service: AdvisoryAccessService
  let auditLogService: jest.Mocked<Pick<AuditLogService, 'log'>>

  beforeEach(() => {
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    }
    service = new AdvisoryAccessService(auditLogService as unknown as AuditLogService)
  })

  it.each([UserRole.ADMIN, UserRole.CONSULTANT, UserRole.CLIENT_PM])(
    'allows %s to access ThinkTank',
    (role) => {
      expect(service.canAccessThinkTank({ id: 'user-1', role })).toBe(true)
    },
  )

  it('denies respondent users', () => {
    expect(
      service.canAccessThinkTank({
        id: 'user-1',
        role: UserRole.RESPONDENT,
      }),
    ).toBe(false)
  })

  it.each([undefined, null, ''])('denies users with missing role value %p', (role) => {
    expect(service.canAccessThinkTank({ id: 'user-1', role })).toBe(false)
  })

  it('keeps the Story 1.1 policy independent from module configuration', () => {
    expect(
      service.canAccessThinkTank({
        id: 'user-1',
        role: UserRole.CONSULTANT,
      }),
    ).toBe(true)
  })

  it('emits the access opened audit event without advisory content', async () => {
    await service.recordAccessOpened({
      user: { id: 'user-1', role: UserRole.CONSULTANT, organizationId: 'org-1' },
      tenantId: 'tenant-1',
    })

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        action: AuditAction.READ,
        entityType: 'ThinkTankAccess',
        entityId: null,
        details: expect.objectContaining({
          eventName: 'thinktank.access.opened',
          outcome: 'success',
          module: 'thinktank',
          occurredAt: expect.any(String),
        }),
      }),
    )
    expect(auditLogService.log.mock.calls[0][0].details).not.toHaveProperty('conversation')
    expect(auditLogService.log.mock.calls[0][0].details).not.toHaveProperty('report')
    expect(auditLogService.log.mock.calls[0][0].details).not.toHaveProperty('enterpriseContext')
  })

  it('emits the access denied audit event with reason', async () => {
    await service.recordAccessDenied({
      user: { id: 'user-1', role: UserRole.RESPONDENT, organizationId: 'org-1' },
      tenantId: 'tenant-1',
      reason: 'role_not_allowed',
    })

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        action: AuditAction.ACCESS_DENIED,
        entityType: 'ThinkTankAccess',
        entityId: null,
        details: expect.objectContaining({
          eventName: 'thinktank.access.denied',
          outcome: 'denied',
          module: 'thinktank',
          reason: 'role_not_allowed',
          occurredAt: expect.any(String),
        }),
      }),
    )
  })
})
