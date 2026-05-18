import { ForbiddenException } from '@nestjs/common'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import {
  AdvisoryAdminService,
  THINKTANK_MODULE_DISABLED_MESSAGE,
} from '../admin/advisory-admin.service'
import { AuditLogService } from '../../audit/audit-log.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import { AdvisoryAccessService } from './advisory-access.service'

describe('AdvisoryAccessService', () => {
  let service: AdvisoryAccessService
  let auditLogService: jest.Mocked<Pick<AuditLogService, 'log'>>
  let advisoryAdminService: jest.Mocked<
    Pick<AdvisoryAdminService, 'getEffectiveModuleConfig' | 'assertThinkTankModuleAvailable'>
  >

  beforeEach(() => {
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    }
    advisoryAdminService = {
      getEffectiveModuleConfig: jest.fn().mockResolvedValue({
        enabled: true,
        allowedRoles: [UserRole.ADMIN, UserRole.CONSULTANT, UserRole.CLIENT_PM],
      }),
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    }
    service = new AdvisoryAccessService(
      new AdvisoryEventService(auditLogService as unknown as AuditLogService),
      advisoryAdminService as unknown as AdvisoryAdminService,
    )
  })

  it('allows access only when tenant config is enabled and the role is bound', async () => {
    await expect(
      service.evaluateAccess(
        {
          id: 'user-1',
          role: UserRole.CONSULTANT,
        },
        'tenant-1',
      ),
    ).resolves.toEqual({ allowed: true })
  })

  it('denies users whose role is not bound in the enabled tenant config', async () => {
    await expect(
      service.evaluateAccess(
        {
          id: 'user-1',
          role: UserRole.RESPONDENT,
        },
        'tenant-1',
      ),
    ).resolves.toEqual({
      allowed: false,
      reason: 'role_not_allowed',
      message: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
    })
  })

  it('denies missing role values with explicit reason', async () => {
    await expect(service.evaluateAccess({ id: 'user-1', role: null }, 'tenant-1')).resolves.toEqual(
      {
        allowed: false,
        reason: 'missing_role',
        message: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
      },
    )
  })

  it('denies disabled tenant config with a distinct disabled message', async () => {
    advisoryAdminService.getEffectiveModuleConfig.mockResolvedValueOnce({
      enabled: false,
      allowedRoles: [UserRole.ADMIN],
    })

    await expect(
      service.evaluateAccess({ id: 'user-1', role: UserRole.ADMIN }, 'tenant-1'),
    ).resolves.toEqual({
      allowed: false,
      reason: 'module_disabled',
      message: THINKTANK_MODULE_DISABLED_MESSAGE,
    })
  })

  it('exposes a reusable disabled-module guard for future session creation paths', async () => {
    advisoryAdminService.assertThinkTankModuleAvailable.mockRejectedValueOnce(
      new ForbiddenException(THINKTANK_MODULE_DISABLED_MESSAGE),
    )

    await expect(
      service.assertThinkTankModuleAvailable({ id: 'user-1', role: UserRole.ADMIN }, 'tenant-1'),
    ).rejects.toThrow(THINKTANK_MODULE_DISABLED_MESSAGE)
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
          event_name: 'thinktank.access.opened',
          event_version: 1,
          tenant_id: 'tenant-1',
          actor_id: 'user-1',
          subject_type: 'module',
          subject_id: 'thinktank',
          outcome: 'success',
          correlation_id: expect.any(String),
          privacy_classification: 'operational',
          module: 'thinktank',
          occurred_at: expect.any(String),
        }),
      }),
    )
    expect(auditLogService.log.mock.calls[0][0].details).not.toHaveProperty('conversation')
    expect(auditLogService.log.mock.calls[0][0].details).not.toHaveProperty('report')
    expect(auditLogService.log.mock.calls[0][0].details).not.toHaveProperty('enterpriseContext')
  })

  it('emits the access denied audit event with tenant-config reason', async () => {
    await service.recordAccessDenied({
      user: { id: 'user-1', role: UserRole.RESPONDENT, organizationId: 'org-1' },
      tenantId: 'tenant-1',
      reason: 'module_disabled',
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
          event_name: 'thinktank.access.denied',
          event_version: 1,
          tenant_id: 'tenant-1',
          actor_id: 'user-1',
          subject_type: 'module',
          subject_id: 'thinktank',
          outcome: 'denied',
          correlation_id: expect.any(String),
          privacy_classification: 'operational',
          module: 'thinktank',
          reason: 'module_disabled',
          occurred_at: expect.any(String),
        }),
      }),
    )
  })
})
