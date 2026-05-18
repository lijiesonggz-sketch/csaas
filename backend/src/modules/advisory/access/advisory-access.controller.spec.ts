import 'reflect-metadata'
import { ForbiddenException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { AuditLogService } from '../../audit/audit-log.service'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisoryAdminService } from '../admin/advisory-admin.service'
import { AdvisoryAccessController } from './advisory-access.controller'
import { AdvisoryAccessService } from './advisory-access.service'

describe('AdvisoryAccessController', () => {
  let controller: AdvisoryAccessController
  let auditLogService: jest.Mocked<Pick<AuditLogService, 'log'>>
  let advisoryAdminService: jest.Mocked<Pick<AdvisoryAdminService, 'getEffectiveModuleConfig'>>

  beforeEach(async () => {
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    }
    advisoryAdminService = {
      getEffectiveModuleConfig: jest.fn().mockResolvedValue({
        enabled: true,
        allowedRoles: [UserRole.ADMIN, UserRole.CONSULTANT, UserRole.CLIENT_PM],
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdvisoryAccessController],
      providers: [
        AdvisoryAccessService,
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
        {
          provide: AdvisoryAdminService,
          useValue: advisoryAdminService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile()

    controller = module.get<AdvisoryAccessController>(AdvisoryAccessController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns the authorized ThinkTank access payload and emits opened audit', async () => {
    const result = await controller.getAccess(
      {
        id: 'user-1',
        role: UserRole.CONSULTANT,
        organizationId: 'org-1',
      },
      'tenant-1',
    )

    expect(result).toEqual({
      data: {
        allowed: true,
        module: 'thinktank',
      },
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
        }),
      }),
    )
  })

  it('blocks enabled tenants when the user role is not bound and emits denied audit', async () => {
    await expect(
      controller.getAccess(
        {
          id: 'user-2',
          role: UserRole.RESPONDENT,
          organizationId: 'org-1',
        },
        'tenant-1',
      ),
    ).rejects.toThrow(ForbiddenException)

    await expect(
      controller.getAccess(
        {
          id: 'user-2',
          role: UserRole.RESPONDENT,
          organizationId: 'org-1',
        },
        'tenant-1',
      ),
    ).rejects.toThrow('当前账号暂无 ThinkTank 访问权限，请联系管理员开通。')

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
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
        }),
      }),
    )
  })

  it('blocks disabled tenants with a distinct disabled-state message', async () => {
    advisoryAdminService.getEffectiveModuleConfig.mockResolvedValueOnce({
      enabled: false,
      allowedRoles: [UserRole.ADMIN],
    })

    await expect(
      controller.getAccess(
        {
          id: 'user-1',
          role: UserRole.ADMIN,
          organizationId: 'org-1',
        },
        'tenant-1',
      ),
    ).rejects.toThrow('ThinkTank 当前未在本租户启用，请联系管理员开通。')

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.ACCESS_DENIED,
        details: expect.objectContaining({
          eventName: 'thinktank.access.denied',
          reason: 'module_disabled',
        }),
      }),
    )
  })
})
