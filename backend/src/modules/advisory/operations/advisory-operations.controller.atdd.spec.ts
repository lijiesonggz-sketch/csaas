import 'reflect-metadata'

const controllerModulePath = './advisory-operations.controller'

const currentTenantId = '660e8400-e29b-41d4-a716-446655440000'
const requestedTenantId = currentTenantId
const forbiddenTenantId = '111e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const dateFrom = '2026-05-01T00:00:00.000Z'
const dateTo = '2026-05-22T23:59:59.999Z'

const adminUser = {
  id: actorId,
  role: 'admin',
  tenantId: currentTenantId,
  organizationId: null,
}

const dashboardPayload = {
  appliedFilters: { tenantId: requestedTenantId, dateFrom, dateTo },
  summary: {
    quickConsult: { started: 2, completed: 1, failed: 1, volume: 2 },
    workflows: { started: 2, completed: 1, startFailed: 0, incomplete: 1, completionRate: 0.5 },
    partyMode: { budgetExceeded: 1, advisorFailed: 0 },
    measurementStatus: 'fresh',
  },
  usageByWorkflowType: [
    { workflowKey: 'problem-solving', starts: 2, completions: 1, incompleteSessions: 1, completionRate: 0.5 },
  ],
  lowCompletionWorkflows: [],
  instrumentationGaps: [],
  freshness: { source: 'audit_logs', status: 'fresh', latestEventAt: '2026-05-21T10:00:00.000Z' },
}

describe('Story 6.1 operations usage controller contract (ATDD RED)', () => {
  test('[P1][6.1-API-001][AC1,AC4] GET usage delegates tenant/date filters and returns the ThinkTank data envelope', async () => {
    const { AdvisoryOperationsController } = await import(controllerModulePath)
    const service = {
      getUsageDashboard: jest.fn().mockResolvedValue(dashboardPayload),
    }
    const controller = new AdvisoryOperationsController(service as never)

    await expect(
      controller.getUsage(adminUser, currentTenantId, {
        tenantId: requestedTenantId,
        dateFrom,
        dateTo,
      }),
    ).resolves.toEqual({ data: dashboardPayload })

    expect(service.getUsageDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: adminUser,
        currentTenantId,
        tenantId: requestedTenantId,
        dateFrom,
        dateTo,
      }),
    )
  })

  test('[P1][6.1-API-002][AC1] defaults query scope to the current tenant and a recent operational window', async () => {
    const { AdvisoryOperationsController } = await import(controllerModulePath)
    const service = {
      getUsageDashboard: jest.fn().mockResolvedValue({
        ...dashboardPayload,
        appliedFilters: { tenantId: currentTenantId, dateFrom: expect.any(String), dateTo: expect.any(String) },
      }),
    }
    const controller = new AdvisoryOperationsController(service as never)

    await controller.getUsage(adminUser, currentTenantId, {})

    expect(service.getUsageDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: adminUser,
        currentTenantId,
        tenantId: currentTenantId,
        dateFrom: expect.any(String),
        dateTo: expect.any(String),
      }),
    )
  })

  test('[P0][6.1-API-004][AC1] rejects tenant filters outside the current tenant scope', async () => {
    const { AdvisoryOperationsController } = await import(controllerModulePath)
    const service = {
      getUsageDashboard: jest.fn(),
    }
    const controller = new AdvisoryOperationsController(service as never)

    await expect(
      controller.getUsage(adminUser, currentTenantId, {
        tenantId: forbiddenTenantId,
      }),
    ).rejects.toThrow('无权查看其他租户')
    expect(service.getUsageDashboard).not.toHaveBeenCalled()
  })

  test('[P1][6.1-API-005][AC1] treats tenantId=current as the guarded current tenant', async () => {
    const { AdvisoryOperationsController } = await import(controllerModulePath)
    const service = {
      getUsageDashboard: jest.fn().mockResolvedValue(dashboardPayload),
    }
    const controller = new AdvisoryOperationsController(service as never)

    await controller.getUsage(adminUser, currentTenantId, { tenantId: 'current' })

    expect(service.getUsageDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        currentTenantId,
        tenantId: currentTenantId,
      }),
    )
  })

  test('[P1][6.1-API-006][AC1] exposes GET /advisory/admin/operations/usage with JWT, tenant, roles, and admin-only metadata', async () => {
    // Provider endpoint: TODO - new backend endpoint, not yet implemented.
    /*
     * Provider Scrutiny Evidence:
     * - Handler: NEW - AdvisoryOperationsController.getUsage is expected for TDD red phase.
     * - Endpoint: GET /advisory/admin/operations/usage.
     * - Status: 200 with { data } for admin success; 401/403 through guards for unauthenticated or non-admin callers.
     * - Query fields: tenantId, dateFrom, dateTo.
     * - Response shape: privacy-safe aggregate usage dashboard, no raw conversation/prompt/content fields.
     */
    const { PATH_METADATA, METHOD_METADATA, GUARDS_METADATA } = await import('@nestjs/common/constants')
    const { RequestMethod } = await import('@nestjs/common')
    const { UserRole } = await import('../../../database/entities/user.entity')
    const { JwtAuthGuard } = await import('../../auth/guards/jwt-auth.guard')
    const { TenantGuard } = await import('../../organizations/guards/tenant.guard')
    const { RolesGuard } = await import('../../auth/guards/roles.guard')
    const { AdvisoryOperationsController } = await import(controllerModulePath)

    expect(Reflect.getMetadata(PATH_METADATA, AdvisoryOperationsController)).toBe('advisory/admin/operations')
    expect(Reflect.getMetadata(PATH_METADATA, AdvisoryOperationsController.prototype.getUsage)).toBe('usage')
    expect(Reflect.getMetadata(METHOD_METADATA, AdvisoryOperationsController.prototype.getUsage)).toBe(RequestMethod.GET)
    expect(Reflect.getMetadata(GUARDS_METADATA, AdvisoryOperationsController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, TenantGuard, RolesGuard]),
    )
    expect(Reflect.getMetadata('roles', AdvisoryOperationsController.prototype.getUsage)).toEqual([
      UserRole.ADMIN,
    ])
  })
})
