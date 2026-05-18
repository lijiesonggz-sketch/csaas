import 'reflect-metadata'
import { ForbiddenException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { AuditLogService } from '../../audit/audit-log.service'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisoryAccessController } from './advisory-access.controller'
import { AdvisoryAccessService } from './advisory-access.service'

describe('AdvisoryAccessController', () => {
  let controller: AdvisoryAccessController
  let auditLogService: jest.Mocked<Pick<AuditLogService, 'log'>>

  beforeEach(async () => {
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdvisoryAccessController],
      providers: [
        AdvisoryAccessService,
        {
          provide: AuditLogService,
          useValue: auditLogService,
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

  it('blocks denied users with a friendly message and emits denied audit', async () => {
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
})
