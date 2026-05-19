import { BadRequestException } from '@nestjs/common'
import { AuditAction, AuditLog } from '../../../database/entities/audit-log.entity'
import { AdvisoryModuleConfig } from '../../../database/entities/advisory-module-config.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import { AdvisoryModuleConfigRepository } from './advisory-module-config.repository'
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

function createConfigRepository(seed: AdvisoryModuleConfig[] = []) {
  const records = [...seed]

  return {
    findByModuleKey: jest.fn(async (scopedTenantId: string, moduleKey: string) => {
      return (
        records.find(
          (record) => record.tenantId === scopedTenantId && record.moduleKey === moduleKey,
        ) ?? null
      )
    }),
    createForTenant: jest.fn(
      async (scopedTenantId: string, input: Partial<AdvisoryModuleConfig>) => {
        const saved = createConfig({
          ...input,
          id: input.id ?? `config-${records.length + 1}`,
          tenantId: scopedTenantId,
          updatedAt: new Date('2026-05-19T00:01:00.000Z'),
        })
        records.push(saved)

        return saved
      },
    ),
    updateForTenant: jest.fn(
      async (scopedTenantId: string, id: string, input: Partial<AdvisoryModuleConfig>) => {
        const index = records.findIndex(
          (record) => record.tenantId === scopedTenantId && record.id === id,
        )

        if (index < 0) return null

        const saved = {
          ...records[index],
          ...input,
          id,
          tenantId: scopedTenantId,
          updatedAt: new Date('2026-05-19T00:01:00.000Z'),
        }

        records[index] = saved

        return saved
      },
    ),
    records,
  }
}

describe('AdvisoryAdminService', () => {
  let repository: ReturnType<typeof createConfigRepository>
  let auditLogService: jest.Mocked<
    Pick<AuditLogService, 'log' | 'logStrict' | 'findRecentByEventNames'>
  >
  let service: AdvisoryAdminService

  beforeEach(() => {
    repository = createConfigRepository()
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
      logStrict: jest.fn().mockResolvedValue({ id: 'audit-1' } as AuditLog),
      findRecentByEventNames: jest.fn().mockResolvedValue([]),
    }
    service = new AdvisoryAdminService(
      repository as unknown as AdvisoryModuleConfigRepository,
      auditLogService as unknown as AuditLogService,
      new AdvisoryEventService(auditLogService as unknown as AuditLogService),
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
    expect(repository.createForTenant).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        moduleKey: THINKTANK_MODULE_KEY,
        enabled: false,
        allowedRoles: [],
        dataRetentionDays: 90,
      }),
    )
  })

  it('recovers from first-use create race by loading the config created by the concurrent request', async () => {
    const racedConfig = createConfig({ enabled: false })
    repository.findByModuleKey.mockResolvedValueOnce(null).mockResolvedValueOnce(racedConfig)
    repository.createForTenant.mockRejectedValueOnce({ code: '23505' })

    const response = await service.getModuleConfig(tenantId)

    expect(response.id).toBe(racedConfig.id)
    expect(repository.createForTenant).toHaveBeenCalledTimes(1)
    expect(repository.findByModuleKey).toHaveBeenNthCalledWith(2, tenantId, THINKTANK_MODULE_KEY)
  })

  it('enables ThinkTank and emits thinktank.module.enabled with changed setting details', async () => {
    repository = createConfigRepository([createConfig({ enabled: false, allowedRoles: [] })])
    service = new AdvisoryAdminService(
      repository as unknown as AdvisoryModuleConfigRepository,
      auditLogService as unknown as AuditLogService,
      new AdvisoryEventService(auditLogService as unknown as AuditLogService),
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
          event_name: 'thinktank.module.enabled',
          event_version: 1,
          tenant_id: tenantId,
          actor_id: adminUser.id,
          subject_type: 'module_config',
          subject_id: '550e8400-e29b-41d4-a716-446655440000',
          module: THINKTANK_MODULE_KEY,
          changed_setting: 'enabled',
          old_value: false,
          new_value: true,
          outcome: 'success',
          occurred_at: expect.any(String),
          correlation_id: expect.any(String),
          privacy_classification: 'operational',
        }),
      }),
    )
  })

  it('disables ThinkTank and emits thinktank.module.disabled', async () => {
    repository = createConfigRepository([
      createConfig({
        enabled: true,
        allowedRoles: [UserRole.ADMIN],
      }),
    ])
    service = new AdvisoryAdminService(
      repository as unknown as AdvisoryModuleConfigRepository,
      auditLogService as unknown as AuditLogService,
      new AdvisoryEventService(auditLogService as unknown as AuditLogService),
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
          event_name: 'thinktank.module.disabled',
          changed_setting: 'enabled',
          old_value: true,
          new_value: false,
        }),
      }),
    )
  })

  it('emits thinktank.role_access.updated when allowedRoles changes', async () => {
    repository = createConfigRepository([
      createConfig({
        enabled: true,
        allowedRoles: [UserRole.ADMIN],
      }),
    ])
    service = new AdvisoryAdminService(
      repository as unknown as AdvisoryModuleConfigRepository,
      auditLogService as unknown as AuditLogService,
      new AdvisoryEventService(auditLogService as unknown as AuditLogService),
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
          event_name: 'thinktank.role_access.updated',
          changed_setting: 'allowedRoles',
          old_value: [UserRole.ADMIN],
          new_value: [UserRole.ADMIN, UserRole.CONSULTANT, UserRole.CLIENT_PM],
        }),
      }),
    )
  })

  it('builds latest audit summary from canonical snake_case details with legacy fallback', async () => {
    repository = createConfigRepository([createConfig({ enabled: true })])
    auditLogService.findRecentByEventNames.mockResolvedValue([
      {
        id: 'audit-1',
        userId: adminUser.id,
        organizationId: tenantId,
        tenantId,
        entityType: THINKTANK_MODULE_CONFIG_ENTITY_TYPE,
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        action: AuditAction.UPDATE,
        changes: null,
        details: {
          event_name: 'thinktank.module.enabled',
          changed_setting: 'enabled',
          old_value: false,
          new_value: true,
          occurred_at: '2026-05-19T00:02:00.000Z',
        },
        ipAddress: null,
        userAgent: null,
        createdAt: new Date('2026-05-19T00:02:01.000Z'),
      } as AuditLog,
      {
        id: 'audit-2',
        userId: adminUser.id,
        organizationId: tenantId,
        tenantId,
        entityType: THINKTANK_MODULE_CONFIG_ENTITY_TYPE,
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        action: AuditAction.UPDATE,
        changes: null,
        details: {
          eventName: 'thinktank.role_access.updated',
          changedSetting: 'allowedRoles',
          oldValue: [],
          newValue: [UserRole.ADMIN],
          occurredAt: '2026-05-19T00:01:00.000Z',
        },
        ipAddress: null,
        userAgent: null,
        createdAt: new Date('2026-05-19T00:01:01.000Z'),
      } as AuditLog,
    ])
    service = new AdvisoryAdminService(
      repository as unknown as AdvisoryModuleConfigRepository,
      auditLogService as unknown as AuditLogService,
      new AdvisoryEventService(auditLogService as unknown as AuditLogService),
    )

    const response = await service.getModuleConfig(tenantId)

    expect(response.latestAuditSummary).toEqual([
      {
        eventName: 'thinktank.module.enabled',
        actorUserId: adminUser.id,
        changedSetting: 'enabled',
        oldValue: false,
        newValue: true,
        occurredAt: '2026-05-19T00:02:00.000Z',
      },
      {
        eventName: 'thinktank.role_access.updated',
        actorUserId: adminUser.id,
        changedSetting: 'allowedRoles',
        oldValue: [],
        newValue: [UserRole.ADMIN],
        occurredAt: '2026-05-19T00:01:00.000Z',
      },
    ])
    expect(auditLogService.findRecentByEventNames).toHaveBeenCalledWith(
      tenantId,
      ['thinktank.module.enabled', 'thinktank.module.disabled', 'thinktank.role_access.updated'],
      5,
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

  it('does not expose another tenant enabled module config through effective access lookup', async () => {
    repository = createConfigRepository([
      createConfig({
        id: 'other-tenant-config',
        tenantId: secondaryTenantId,
        enabled: true,
        allowedRoles: [UserRole.ADMIN],
      }),
    ])
    service = new AdvisoryAdminService(
      repository as unknown as AdvisoryModuleConfigRepository,
      auditLogService as unknown as AuditLogService,
      new AdvisoryEventService(auditLogService as unknown as AuditLogService),
    )

    const response = await service.getEffectiveModuleConfig(tenantId)

    expect(response).toEqual({
      enabled: false,
      allowedRoles: [],
    })
    expect(repository.findByModuleKey).toHaveBeenCalledWith(tenantId, THINKTANK_MODULE_KEY)
  })

  it('ignores tenant id supplied in update payload and persists only CurrentTenant scope', async () => {
    repository = createConfigRepository([createConfig({ enabled: false })])
    service = new AdvisoryAdminService(
      repository as unknown as AdvisoryModuleConfigRepository,
      auditLogService as unknown as AuditLogService,
      new AdvisoryEventService(auditLogService as unknown as AuditLogService),
    )

    const response = await service.updateModuleConfig(tenantId, adminUser, {
      tenantId: secondaryTenantId,
      enabled: true,
      allowedRoles: [UserRole.ADMIN],
      dataRetentionDays: 90,
      privacyConfirmed: true,
    } as never)

    expect(response.tenantId).toBe(tenantId)
    expect(response.tenantId).not.toBe(secondaryTenantId)
    expect(repository.updateForTenant).toHaveBeenCalledWith(
      tenantId,
      '550e8400-e29b-41d4-a716-446655440000',
      expect.not.objectContaining({ tenantId: secondaryTenantId }),
    )
  })

  it('does not read or overwrite another tenant advisory_module_configs row', async () => {
    repository = createConfigRepository([
      createConfig({
        id: 'other-tenant-config',
        tenantId: secondaryTenantId,
        enabled: false,
      }),
    ])
    service = new AdvisoryAdminService(
      repository as unknown as AdvisoryModuleConfigRepository,
      auditLogService as unknown as AuditLogService,
      new AdvisoryEventService(auditLogService as unknown as AuditLogService),
    )

    const response = await service.updateModuleConfig(tenantId, adminUser, {
      enabled: true,
      allowedRoles: [UserRole.ADMIN],
      dataRetentionDays: 90,
      privacyConfirmed: true,
    })

    expect(response.tenantId).toBe(tenantId)
    expect(repository.records.find((record) => record.id === 'other-tenant-config')).toMatchObject({
      tenantId: secondaryTenantId,
      enabled: false,
    })
  })

  it('reports disabled access distinctly from role denial', async () => {
    repository = createConfigRepository([createConfig({ enabled: false })])
    service = new AdvisoryAdminService(
      repository as unknown as AdvisoryModuleConfigRepository,
      auditLogService as unknown as AuditLogService,
      new AdvisoryEventService(auditLogService as unknown as AuditLogService),
    )

    await expect(service.assertThinkTankModuleAvailable(adminUser, tenantId)).rejects.toThrow(
      THINKTANK_MODULE_DISABLED_MESSAGE,
    )
  })
})
