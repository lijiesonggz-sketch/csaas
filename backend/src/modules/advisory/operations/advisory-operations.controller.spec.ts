import 'reflect-metadata'
import { METHOD_METADATA, PATH_METADATA, GUARDS_METADATA } from '@nestjs/common/constants'
import { RequestMethod } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { UserRole } from '../../../database/entities/user.entity'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisoryOperationsController } from './advisory-operations.controller'

const currentTenantId = '660e8400-e29b-41d4-a716-446655440000'
const requestedTenantId = currentTenantId
const otherTenantId = '111e8400-e29b-41d4-a716-446655440000'
const actor = {
  id: '770e8400-e29b-41d4-a716-446655440000',
  role: UserRole.ADMIN,
  tenantId: currentTenantId,
  organizationId: null,
}

describe('AdvisoryOperationsController', () => {
  it('exposes the admin operations usage endpoint behind the expected guards and role metadata', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdvisoryOperationsController)).toBe(
      'advisory/admin/operations',
    )
    expect(Reflect.getMetadata(GUARDS_METADATA, AdvisoryOperationsController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, TenantGuard, RolesGuard]),
    )
    expect(Reflect.getMetadata(PATH_METADATA, AdvisoryOperationsController.prototype.getUsage)).toBe(
      'usage',
    )
    expect(
      Reflect.getMetadata(METHOD_METADATA, AdvisoryOperationsController.prototype.getUsage),
    ).toBe(RequestMethod.GET)
    expect(Reflect.getMetadata('roles', AdvisoryOperationsController.prototype.getUsage)).toEqual([
      UserRole.ADMIN,
    ])
  })

  it('returns the ThinkTank data envelope and delegates tenant/date filters', async () => {
    const payload = {
      appliedFilters: {
        tenantId: requestedTenantId,
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-22T23:59:59.999Z',
      },
      summary: {
        quickConsult: { started: 2, completed: 1, failed: 1, volume: 2 },
        workflows: { started: 2, completed: 1, startFailed: 0, incomplete: 1, completionRate: 0.5 },
        partyMode: { budgetExceeded: 1, advisorFailed: 0 },
        measurementStatus: 'fresh',
      },
      usageByWorkflowType: [],
      lowCompletionWorkflows: [],
      instrumentationGaps: [],
      freshness: { source: 'audit_logs', status: 'fresh', latestEventAt: '2026-05-21T10:00:00.000Z' },
    }
    const service = {
      getUsageDashboard: jest.fn().mockResolvedValue(payload),
    }
    const controller = new AdvisoryOperationsController(service as never)

    await expect(
      controller.getUsage(actor, currentTenantId, {
        tenantId: requestedTenantId,
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-22T23:59:59.999Z',
      }),
    ).resolves.toEqual({ data: payload })

    expect(service.getUsageDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        currentTenantId,
        tenantId: requestedTenantId,
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-22T23:59:59.999Z',
      }),
    )
  })

  it('rejects tenant filters outside the current tenant scope', async () => {
    const service = {
      getUsageDashboard: jest.fn(),
    }
    const controller = new AdvisoryOperationsController(service as never)

    await expect(
      controller.getUsage(actor, currentTenantId, {
        tenantId: otherTenantId,
      }),
    ).rejects.toThrow('无权查看其他租户')
    expect(service.getUsageDashboard).not.toHaveBeenCalled()
  })

  it('defaults omitted query filters to the current tenant and a recent operations window', async () => {
    const service = {
      getUsageDashboard: jest.fn().mockResolvedValue({
        appliedFilters: { tenantId: currentTenantId, dateFrom: 'x', dateTo: 'y' },
      }),
    }
    const controller = new AdvisoryOperationsController(service as never)

    await controller.getUsage(actor, currentTenantId, {})

    expect(service.getUsageDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        currentTenantId,
        tenantId: currentTenantId,
        dateFrom: expect.any(String),
        dateTo: expect.any(String),
      }),
    )
  })
})
