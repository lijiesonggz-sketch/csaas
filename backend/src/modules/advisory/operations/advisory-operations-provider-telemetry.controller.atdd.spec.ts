import 'reflect-metadata'
import { METHOD_METADATA, PATH_METADATA, GUARDS_METADATA } from '@nestjs/common/constants'
import { RequestMethod } from '@nestjs/common'
import { UserRole } from '../../../database/entities/user.entity'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisoryOperationsController } from './advisory-operations.controller'

const currentTenantId = '660e8400-e29b-41d4-a716-446655440000'
const otherTenantId = '111e8400-e29b-41d4-a716-446655440000'
const actor = {
  id: '770e8400-e29b-41d4-a716-446655440000',
  role: UserRole.ADMIN,
  tenantId: currentTenantId,
  organizationId: null,
}

function createController(service: Record<string, unknown>) {
  return Reflect.construct(AdvisoryOperationsController, [service, service]) as any
}

/*
 * Provider Scrutiny Evidence:
 * - Handler: backend/src/modules/advisory/operations/advisory-operations.controller.ts
 * - Endpoint: NEW - GET /advisory/admin/operations/provider-telemetry
 * - Status: 200 with { data } for authorized admin requests; 403 for foreign tenant; 400 for invalid date windows
 * - Response shape: aggregate-only generatedAt, appliedFilters, summary, byWorkflow, byExperience, byProvider, cache, instrumentationGaps, freshness
 * - Required guards: JwtAuthGuard, TenantGuard, RolesGuard, UserRole.ADMIN
 * - Privacy: response must not expose actor-level rows, raw event details, prompt, message, content, report, feedback, or raw cache payloads
 */
describe('Story 6.2 provider telemetry operations endpoint ATDD', () => {
  test('[P1][6.2-API-006][AC1,AC2] exposes provider telemetry endpoint behind admin guards and role metadata', () => {
    const handler = (AdvisoryOperationsController.prototype as unknown as Record<string, unknown>)
      .getProviderTelemetry

    expect(Reflect.getMetadata(PATH_METADATA, AdvisoryOperationsController)).toBe(
      'advisory/admin/operations',
    )
    expect(Reflect.getMetadata(GUARDS_METADATA, AdvisoryOperationsController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, TenantGuard, RolesGuard]),
    )
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('provider-telemetry')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET)
    expect(Reflect.getMetadata('roles', handler)).toEqual([UserRole.ADMIN])
  })

  test('[P1][6.2-API-007][AC1] returns the data envelope and delegates current tenant date workflow and grouping filters', async () => {
    const payload = {
      generatedAt: '2026-05-22T17:40:00.000Z',
      appliedFilters: {
        tenantId: currentTenantId,
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-22T23:59:59.999Z',
        workflowType: 'party-mode',
      },
      summary: {
        terminalCalls: 3,
        successfulCalls: 2,
        failedCalls: 1,
        retryEvents: 1,
        errorRate: 0.3333,
        timeoutRate: 0.3333,
        estimatedTokens: 350,
        estimatedCost: 0.55,
        measurementStatus: 'fresh',
      },
      byWorkflow: [],
      byExperience: [],
      byProvider: [],
      cache: { hits: 1, misses: 1, bypasses: 0, totalLookups: 2, hitRate: 0.5 },
      instrumentationGaps: [],
      freshness: {
        source: 'audit_logs',
        status: 'fresh',
        latestEventAt: '2026-05-21T10:00:00.000Z',
      },
    }
    const service = { getProviderTelemetry: jest.fn().mockResolvedValue(payload) }
    const controller = createController(service)

    await expect(
      controller.getProviderTelemetry(actor, currentTenantId, {
        tenantId: 'current',
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-22T23:59:59.999Z',
        workflowType: 'party-mode',
        groupBy: 'workflow,experience,provider',
      }),
    ).resolves.toEqual({ data: payload })

    expect(service.getProviderTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        currentTenantId,
        tenantId: currentTenantId,
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-22T23:59:59.999Z',
        workflowType: 'party-mode',
        groupBy: ['workflow', 'experience', 'provider'],
      }),
    )
  })

  test('[P1][6.2-API-008][AC2] rejects foreign tenant and malformed date windows before querying telemetry', async () => {
    const service = { getProviderTelemetry: jest.fn() }
    const controller = createController(service)

    await expect(
      controller.getProviderTelemetry(actor, currentTenantId, { tenantId: otherTenantId }),
    ).rejects.toThrow()
    await expect(
      controller.getProviderTelemetry(actor, currentTenantId, {
        tenantId: 'current',
        dateFrom: '2026-05-22T23:59:59.999Z',
        dateTo: '2026-05-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(/date/i)
    await expect(
      controller.getProviderTelemetry(actor, currentTenantId, {
        tenantId: 'current',
        dateFrom: 'not-a-date',
        dateTo: '2026-05-22T23:59:59.999Z',
      }),
    ).rejects.toThrow(/date/i)
    await expect(
      controller.getProviderTelemetry(actor, currentTenantId, {
        tenantId: 'current',
        dateFrom: ['2026-05-01'] as any,
        dateTo: '2026-05-22T23:59:59.999Z',
      }),
    ).rejects.toThrow(/date/i)
    await expect(
      controller.getProviderTelemetry(actor, currentTenantId, {
        tenantId: ['current'] as any,
      }),
    ).rejects.toThrow(/tenantId/i)
    await expect(
      controller.getProviderTelemetry(actor, currentTenantId, {
        tenantId: 'current',
        dateFrom: '2026-02-31',
        dateTo: '2026-05-22',
      }),
    ).rejects.toThrow(/date/i)
    await expect(
      controller.getProviderTelemetry(actor, currentTenantId, {
        tenantId: 'current',
        dateFrom: '2026-01-01',
        dateTo: '2026-05-22',
      }),
    ).rejects.toThrow(/90 days/i)
    await expect(
      controller.getProviderTelemetry(actor, currentTenantId, {
        tenantId: 'current',
        groupBy: 'workflow,bogus',
      }),
    ).rejects.toThrow(/groupBy/i)

    expect(service.getProviderTelemetry).not.toHaveBeenCalled()
  })

  test('[P1][6.2-API-009][AC2] passes through unavailable freshness and never returns raw telemetry details', async () => {
    const payload = {
      generatedAt: '2026-05-22T17:40:00.000Z',
      appliedFilters: {
        tenantId: currentTenantId,
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-22T23:59:59.999Z',
      },
      summary: {
        terminalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        errorRate: null,
        timeoutRate: null,
        estimatedTokens: 0,
        estimatedCost: 0,
        measurementStatus: 'unavailable',
      },
      byWorkflow: [],
      byExperience: [],
      byProvider: [],
      cache: { hits: 0, misses: 0, bypasses: 0, totalLookups: 0, hitRate: null },
      instrumentationGaps: [{ reason: 'telemetry_source_unavailable', source: 'audit_logs' }],
      freshness: { source: 'audit_logs', status: 'unavailable', latestEventAt: null },
    }
    const service = { getProviderTelemetry: jest.fn().mockResolvedValue(payload) }
    const controller = createController(service)

    const response = await controller.getProviderTelemetry(actor, currentTenantId, {
      tenantId: 'current',
    })

    expect(response).toEqual({ data: payload })
    expect(JSON.stringify(response)).not.toMatch(
      /PRIVATE_|prompt|message|content|conversation|report|feedback/i,
    )
    expect(response.data.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'telemetry_source_unavailable', source: 'audit_logs' }),
      ]),
    )
  })
})
