import { BadRequestException } from '@nestjs/common'
import { Repository } from 'typeorm'
import { AuditAction, AuditLog } from '../../../database/entities/audit-log.entity'
import { AdvisoryModuleConfig } from '../../../database/entities/advisory-module-config.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import {
  AdvisoryAdminService,
  THINKTANK_MODULE_CONFIG_ENTITY_TYPE,
  THINKTANK_MODULE_DISABLED_MESSAGE,
  THINKTANK_MODULE_KEY,
} from './advisory-admin.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const secondaryTenantId = '660e8400-e29b-41d4-a716-446655440999'
const adminUser = {
  id: '770e8400-e29b-41d4-a716-446655440000',
  role: UserRole.ADMIN,
  tenantId,
  organizationId: tenantId,
}

function createConfig(overrides: Partial<AdvisoryModuleConfig> = {}): AdvisoryModuleConfig {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId,
    moduleKey: THINKTANK_MODULE_KEY,
    enabled: false,
    allowedRoles: [],
    dataRetentionDays: 90,
    privacyConfirmedAt: null,
    privacyConfirmedBy: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date('2026-05-19T00:00:00.000Z'),
    updatedAt: new Date('2026-05-19T00:00:00.000Z'),
    ...overrides,
  }
}

function createRepository(seed: AdvisoryModuleConfig[] = []) {
  const records = [...seed]

  return {
    findOne: jest.fn(async ({ where }: { where: { tenantId: string; moduleKey: string } }) => {
      return (
        records.find(
          (record) => record.tenantId === where.tenantId && record.moduleKey === where.moduleKey,
        ) ?? null
      )
    }),
    create: jest.fn((input: Partial<AdvisoryModuleConfig>) => createConfig(input)),
    save: jest.fn(async (input: AdvisoryModuleConfig) => {
      const index = records.findIndex(
        (record) => record.tenantId === input.tenantId && record.moduleKey === input.moduleKey,
      )
      const saved = {
        ...input,
        id: input.id ?? `config-${records.length + 1}`,
        updatedAt: new Date('2026-05-19T00:01:00.000Z'),
      }

      if (index >= 0) {
        records[index] = saved
      } else {
        records.push(saved)
      }

      return saved
    }),
    records,
  }
}

describe('AdvisoryAdminService', () => {
  let repository: ReturnType<typeof createRepository>
  let auditLogService: jest.Mocked<Pick<AuditLogService, 'logStrict' | 'findRecentByEventNames'>>
  let service: AdvisoryAdminService

  beforeEach(() => {
    repository = createRepository()
    auditLogService = {
      logStrict: jest.fn().mockResolvedValue({ id: 'audit-1' } as AuditLog),
      findRecentByEventNames: jest.fn().mockResolvedValue([]),
    }
    service = new AdvisoryAdminService(
      repository as unknown as Repository<AdvisoryModuleConfig>,
      auditLogService as unknown as AuditLogService,
    )
  })

  it('creates a tenant default config as disabled with empty roles and 90-day retention', async () => {
    const response = await service.getModuleConfig(tenantId)

    expect(response).toMatchObject({
      tenantId,
      moduleKey: THINKTANK_MODULE_KEY,
      enabled: false,
      allowedRoles: [],
      dataRetentionDays: 90,
      privacyConfirmedAt: null,
      privacyConfirmedBy: null,
      latestAuditSummary: [],
    })
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        moduleKey: THINKTANK_MODULE_KEY,
        enabled: false,
        allowedRoles: [],
        dataRetentionDays: 90,
      }),
    )
  })

  it('enables ThinkTank and emits thinktank.module.enabled with changed setting details', async () => {
    repository = createRepository([createConfig({ enabled: false, allowedRoles: [] })])
    service = new AdvisoryAdminService(
      repository as unknown as Repository<AdvisoryModuleConfig>,
      auditLogService as unknown as AuditLogService,
    )

    const response = await service.updateModuleConfig(tenantId, adminUser, {
      enabled: true,
      allowedRoles: [UserRole.ADMIN, UserRole.CONSULTANT],
      dataRetentionDays: 90,
      privacyConfirmed: true,
    })

    expect(response.enabled).toBe(true)
    expect(response.allowedRoles).toEqual([UserRole.ADMIN, UserRole.CONSULTANT])
    expect(response.privacyConfirmedBy).toBe(adminUser.id)
    expect(auditLogService.logStrict).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: adminUser.id,
        tenantId,
        action: AuditAction.UPDATE,
        entityType: THINKTANK_MODULE_CONFIG_ENTITY_TYPE,
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        details: expect.objectContaining({
          eventName: 'thinktank.module.enabled',
          module: THINKTANK_MODULE_KEY,
          changedSetting: 'enabled',
          oldValue: false,
          newValue: true,
          outcome: 'success',
          occurredAt: expect.any(String),
        }),
      }),
    )
  })

  it('disables ThinkTank and emits thinktank.module.disabled', async () => {
    repository = createRepository([
      createConfig({
        enabled: true,
        allowedRoles: [UserRole.ADMIN],
      }),
    ])
    service = new AdvisoryAdminService(
      repository as unknown as Repository<AdvisoryModuleConfig>,
      auditLogService as unknown as AuditLogService,
    )

    await service.updateModuleConfig(tenantId, adminUser, {
      enabled: false,
      allowedRoles: [UserRole.ADMIN],
      dataRetentionDays: 90,
      privacyConfirmed: true,
    })

    expect(auditLogService.logStrict).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          eventName: 'thinktank.module.disabled',
          changedSetting: 'enabled',
          oldValue: true,
          newValue: false,
        }),
      }),
    )
  })

  it('emits thinktank.role_access.updated when allowedRoles changes', async () => {
    repository = createRepository([
      createConfig({
        enabled: true,
        allowedRoles: [UserRole.ADMIN],
      }),
    ])
    service = new AdvisoryAdminService(
      repository as unknown as Repository<AdvisoryModuleConfig>,
      auditLogService as unknown as AuditLogService,
    )

    await service.updateModuleConfig(tenantId, adminUser, {
      enabled: true,
      allowedRoles: [UserRole.ADMIN, UserRole.CONSULTANT, UserRole.CLIENT_PM],
      dataRetentionDays: 90,
      privacyConfirmed: true,
    })

    expect(auditLogService.logStrict).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          eventName: 'thinktank.role_access.updated',
          changedSetting: 'allowedRoles',
          oldValue: [UserRole.ADMIN],
          newValue: [UserRole.ADMIN, UserRole.CONSULTANT, UserRole.CLIENT_PM],
        }),
      }),
    )
  })

  it('rejects roles outside the existing CSAAS RBAC model', async () => {
    await expect(
      service.updateModuleConfig(tenantId, adminUser, {
        enabled: true,
        allowedRoles: [UserRole.ADMIN, 'thinktank_operator' as UserRole],
        dataRetentionDays: 90,
        privacyConfirmed: true,
      }),
    ).rejects.toThrow(BadRequestException)
  })

  it('ignores tenant id supplied in update payload and persists only CurrentTenant scope', async () => {
    const response = await service.updateModuleConfig(tenantId, adminUser, {
      tenantId: secondaryTenantId,
      enabled: true,
      allowedRoles: [UserRole.ADMIN],
      dataRetentionDays: 90,
      privacyConfirmed: true,
    } as never)

    expect(response.tenantId).toBe(tenantId)
    expect(response.tenantId).not.toBe(secondaryTenantId)
  })

  it('reports disabled access distinctly from role denial', async () => {
    repository = createRepository([createConfig({ enabled: false })])
    service = new AdvisoryAdminService(
      repository as unknown as Repository<AdvisoryModuleConfig>,
      auditLogService as unknown as AuditLogService,
    )

    await expect(service.assertThinkTankModuleAvailable(adminUser, tenantId)).rejects.toThrow(
      THINKTANK_MODULE_DISABLED_MESSAGE,
    )
  })
})
