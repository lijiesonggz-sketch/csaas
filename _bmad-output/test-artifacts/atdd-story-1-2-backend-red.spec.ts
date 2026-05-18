/**
 * ATDD RED - Story 1.2: Tenant Module Enablement and Role Permissions
 *
 * Acceptance Criteria:
 *   AC1: Tenant administrators can enable ThinkTank for authorized tenant users.
 *   AC2: Module configuration shows status, role binding, retention, privacy, and audit summary.
 *   AC3: Enable emits thinktank.module.enabled.
 *   AC4: Disabled tenants receive a clear unavailable message.
 *   AC5: Disabled tenants cannot create advisory sessions; reusable availability guard exists.
 *   AC6: Disable emits thinktank.module.disabled.
 *   AC7: Existing CSAAS RBAC roles drive access without a ThinkTank account model.
 *   AC8: Role binding changes emit thinktank.role_access.updated.
 *
 * TDD RED PHASE: All tests use test.skip().
 * These tests describe expected behavior before implementation. They should remain skipped
 * in ATDD artifacts and be converted into focused green-phase tests during bmad-dev-story.
 *
 * Provider endpoint:
 * - Existing endpoint to extend: GET /api/advisory/access.
 * - New endpoints: GET /api/advisory/admin/module-config,
 *   PUT /api/advisory/admin/module-config.
 *
 * Provider Scrutiny Evidence:
 * - Guards: JwtAuthGuard + TenantGuard for all routes; RolesGuard + @Roles(admin) for admin routes.
 * - Tenant source: CurrentTenant only; request body tenant id must be ignored or rejected.
 * - Success response envelope: { data: ... }.
 * - Config fields: enabled, allowedRoles, dataRetentionDays, privacy confirmation, latestAuditSummary.
 * - Valid roles: admin, consultant, client_pm, respondent.
 * - Disabled access status: 403 with clear tenant-disabled message.
 * - Audit events: thinktank.module.enabled, thinktank.module.disabled,
 *   thinktank.role_access.updated, while preserving access opened/denied events.
 */

import {
  accessBackendEndpoint,
  adminBackendEndpoint,
  advisoryModuleMessages,
  csaasRoles,
  createAdvisoryModuleConfig,
  createUser,
  expectedAdminConfigResponse,
  expectedAuditEvents,
  forbiddenRuntimeTables,
  tenantFixtures,
} from './atdd-story-1-2-fixtures'

interface AuditRecord {
  action: string
  entityType: string
  entityId: string | null
  userId: string
  tenantId: string
  details: Record<string, unknown>
}

interface AdvisoryModuleAdminSubject {
  getDefaultConfig: (tenantId: string) => ReturnType<typeof createAdvisoryModuleConfig>
  getConfig: (input: { user: ReturnType<typeof createUser>; tenantId: string }) => Promise<{
    status: number
    body: typeof expectedAdminConfigResponse
  }>
  updateConfig: (input: {
    user: ReturnType<typeof createUser>
    tenantId: string
    body: Record<string, unknown>
  }) => Promise<{
    status: number
    body?: { data: ReturnType<typeof createAdvisoryModuleConfig> }
    auditLog: AuditRecord[]
    error?: { status: number; message: string | string[] }
  }>
  getAccess: (input: {
    user: ReturnType<typeof createUser>
    tenantId: string
  }) => Promise<{
    status: number
    body?: { data: { allowed: true; module: 'thinktank' } }
    error?: { status: number; message: string }
    auditLog: AuditRecord[]
  }>
  assertThinkTankModuleAvailable: (input: {
    user: ReturnType<typeof createUser>
    tenantId: string
  }) => Promise<void>
  listCreatedAdvisoryTables: () => string[]
  getRegisteredEntityNames: () => string[]
}

describe('Story 1.2 ATDD RED - ThinkTank tenant module config backend', () => {
  const createSubject = (): AdvisoryModuleAdminSubject => {
    throw new Error(
      'RED PHASE: advisory module config entity/service/controller and tenant-config access policy are not implemented yet',
    )
  }

  test.skip('[P0][1.2-BE-001] should default missing tenant config to disabled with 90-day retention', () => {
    const subject = createSubject()

    expect(subject.getDefaultConfig(tenantFixtures.primaryTenantId)).toEqual(
      createAdvisoryModuleConfig({
        tenantId: tenantFixtures.primaryTenantId,
        enabled: false,
        allowedRoles: [],
        dataRetentionDays: 90,
        privacyConfirmedAt: null,
        privacyConfirmedBy: null,
      }),
    )
  })

  test.skip('[P0][1.2-BE-002] should return admin module config with status, role binding, retention, privacy, and audit summary', async () => {
    const subject = createSubject()

    const result = await subject.getConfig({
      user: createUser('admin'),
      tenantId: tenantFixtures.primaryTenantId,
    })

    expect(result.status).toBe(200)
    expect(result.body).toEqual(expectedAdminConfigResponse)
  })

  test.skip('[P0][1.2-BE-003] should enable ThinkTank and audit thinktank.module.enabled', async () => {
    const subject = createSubject()

    const result = await subject.updateConfig({
      user: createUser('admin'),
      tenantId: tenantFixtures.primaryTenantId,
      body: {
        enabled: true,
        allowedRoles: ['admin', 'consultant', 'client_pm'],
        dataRetentionDays: 90,
        privacyConfirmed: true,
      },
    })

    expect(result.status).toBe(200)
    expect(result.body?.data.enabled).toBe(true)
    expect(result.auditLog).toContainEqual(
      expect.objectContaining({
        action: 'UPDATE',
        entityType: 'ThinkTankModuleConfig',
        userId: tenantFixtures.adminUserId,
        tenantId: tenantFixtures.primaryTenantId,
        details: expect.objectContaining({
          eventName: expectedAuditEvents.moduleEnabled,
          changedSetting: 'enabled',
          oldValue: false,
          newValue: true,
          outcome: 'success',
          module: 'thinktank',
          occurredAt: expect.any(String),
        }),
      }),
    )
  })

  test.skip('[P0][1.2-BE-004] should disable ThinkTank and audit thinktank.module.disabled', async () => {
    const subject = createSubject()

    const result = await subject.updateConfig({
      user: createUser('admin'),
      tenantId: tenantFixtures.primaryTenantId,
      body: {
        enabled: false,
        allowedRoles: ['admin'],
        dataRetentionDays: 90,
        privacyConfirmed: true,
      },
    })

    expect(result.status).toBe(200)
    expect(result.body?.data.enabled).toBe(false)
    expect(result.auditLog).toContainEqual(
      expect.objectContaining({
        action: 'UPDATE',
        entityType: 'ThinkTankModuleConfig',
        tenantId: tenantFixtures.primaryTenantId,
        details: expect.objectContaining({
          eventName: expectedAuditEvents.moduleDisabled,
          changedSetting: 'enabled',
          oldValue: true,
          newValue: false,
        }),
      }),
    )
  })

  test.skip('[P0][1.2-BE-005] should update allowedRoles using existing CSAAS RBAC roles and audit role changes', async () => {
    const subject = createSubject()

    const result = await subject.updateConfig({
      user: createUser('admin'),
      tenantId: tenantFixtures.primaryTenantId,
      body: {
        enabled: true,
        allowedRoles: csaasRoles,
        dataRetentionDays: 90,
        privacyConfirmed: true,
      },
    })

    expect(result.status).toBe(200)
    expect(result.body?.data.allowedRoles).toEqual(csaasRoles)
    expect(result.auditLog).toContainEqual(
      expect.objectContaining({
        action: 'UPDATE',
        entityType: 'ThinkTankModuleConfig',
        details: expect.objectContaining({
          eventName: expectedAuditEvents.roleAccessUpdated,
          changedSetting: 'allowedRoles',
          oldValue: expect.any(Array),
          newValue: csaasRoles,
        }),
      }),
    )
  })

  test.skip('[P0][1.2-BE-006] should reject invalid roles and avoid ThinkTank-specific account models', async () => {
    const subject = createSubject()

    const result = await subject.updateConfig({
      user: createUser('admin'),
      tenantId: tenantFixtures.primaryTenantId,
      body: {
        enabled: true,
        allowedRoles: ['admin', 'thinktank_operator'],
        dataRetentionDays: 90,
        privacyConfirmed: true,
      },
    })

    expect(result.error).toEqual({
      status: 400,
      message: expect.arrayContaining([expect.stringContaining('allowedRoles')]),
    })
    expect(subject.getRegisteredEntityNames()).not.toContain('ThinkTankAccount')
  })

  test.skip('[P0][1.2-BE-007] should allow /advisory/access only when tenant config is enabled and user role is bound', async () => {
    const subject = createSubject()

    const result = await subject.getAccess({
      user: createUser('consultant'),
      tenantId: tenantFixtures.primaryTenantId,
    })

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      data: {
        allowed: true,
        module: 'thinktank',
      },
    })
    expect(result.auditLog).toContainEqual(
      expect.objectContaining({
        details: expect.objectContaining({
          eventName: expectedAuditEvents.accessOpened,
          outcome: 'success',
        }),
      }),
    )
  })

  test.skip('[P0][1.2-BE-008] should deny enabled tenants when the user role is not bound', async () => {
    const subject = createSubject()

    const result = await subject.getAccess({
      user: createUser('respondent'),
      tenantId: tenantFixtures.primaryTenantId,
    })

    expect(result.error).toEqual({
      status: 403,
      message: advisoryModuleMessages.roleDenied,
    })
    expect(result.auditLog).toContainEqual(
      expect.objectContaining({
        details: expect.objectContaining({
          eventName: expectedAuditEvents.accessDenied,
          reason: 'role_not_allowed',
        }),
      }),
    )
  })

  test.skip('[P0][1.2-BE-009] should deny disabled tenants with clear disabled-state message before any session creation', async () => {
    const subject = createSubject()

    await expect(
      subject.assertThinkTankModuleAvailable({
        user: createUser('admin'),
        tenantId: tenantFixtures.primaryTenantId,
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: advisoryModuleMessages.disabled,
    })

    const result = await subject.getAccess({
      user: createUser('admin'),
      tenantId: tenantFixtures.primaryTenantId,
    })

    expect(result.error).toEqual({
      status: 403,
      message: advisoryModuleMessages.disabled,
    })
  })

  test.skip('[P0][1.2-BE-010] should scope admin config reads and writes to CurrentTenant instead of request body tenant id', async () => {
    const subject = createSubject()

    const result = await subject.updateConfig({
      user: createUser('admin'),
      tenantId: tenantFixtures.primaryTenantId,
      body: {
        tenantId: tenantFixtures.secondaryTenantId,
        enabled: true,
        allowedRoles: ['admin'],
        dataRetentionDays: 90,
        privacyConfirmed: true,
      },
    })

    expect(result.status).toBe(200)
    expect(result.body?.data.tenantId).toBe(tenantFixtures.primaryTenantId)
    expect(result.body?.data.tenantId).not.toBe(tenantFixtures.secondaryTenantId)
  })

  test.skip('[P1][1.2-BE-011] should register only advisory_module_configs and not front-load future runtime tables', () => {
    const subject = createSubject()

    expect(subject.listCreatedAdvisoryTables()).toContain('advisory_module_configs')
    for (const forbiddenTable of forbiddenRuntimeTables) {
      expect(subject.listCreatedAdvisoryTables()).not.toContain(forbiddenTable)
    }
  })

  test.skip('[P1][1.2-BE-012] should expose documented backend endpoints for admin config and access checks', () => {
    expect(adminBackendEndpoint).toBe('/api/advisory/admin/module-config')
    expect(accessBackendEndpoint).toBe('/api/advisory/access')
  })
})
