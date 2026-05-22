import { INestApplication, UnauthorizedException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { UserRole } from '../../../database/entities/user.entity'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AuditLogService } from '../../audit/audit-log.service'
import { THINKTANK_EVENT_VERSION, ThinkTankEventName } from '../events/thinktank-event-contract'
import { AdvisoryOperationsController } from './advisory-operations.controller'
import { AdvisoryOperationsService } from './advisory-operations.service'
import { AdvisoryProviderTelemetryService } from './advisory-provider-telemetry.service'

const currentTenantId = '660e8400-e29b-41d4-a716-446655440000'
const actor = {
  id: '770e8400-e29b-41d4-a716-446655440000',
  role: UserRole.ADMIN,
  tenantId: currentTenantId,
  organizationId: null,
}

const otherTenantId = '111e8400-e29b-41d4-a716-446655440000'
const rawConversation = 'PRIVATE_PROMPT_DO_NOT_RETURN_FROM_USAGE_ENDPOINT'
const rawProviderPayload = 'PRIVATE_PROMPT_DO_NOT_RETURN_FROM_PROVIDER_TELEMETRY'

function auditLog(
  id: string,
  overrides: Record<string, unknown>,
  options: { tenantId?: string; createdAt?: Date } = {},
) {
  return {
    id,
    tenantId: options.tenantId ?? currentTenantId,
    userId: actor.id,
    entityType: 'ThinkTankEvent',
    entityId: String(overrides.subject_id ?? id),
    createdAt: options.createdAt ?? new Date('2026-05-21T10:00:00.000Z'),
    details: {
      event_name: ThinkTankEventName.WorkflowStarted,
      event_version: THINKTANK_EVENT_VERSION,
      tenant_id: currentTenantId,
      actor_id: actor.id,
      subject_type: 'workflow',
      subject_id: id,
      outcome: 'success',
      occurred_at: '2026-05-21T10:00:00.000Z',
      correlation_id: `corr-${id}`,
      privacy_classification: 'operational',
      workflow_type: 'problem-solving',
      ...overrides,
    },
  }
}

function providerTelemetryAuditLog(
  id: string,
  overrides: Record<string, unknown>,
  options: { tenantId?: string; createdAt?: Date } = {},
) {
  return {
    id,
    tenantId: options.tenantId ?? currentTenantId,
    userId: actor.id,
    entityType: 'ThinkTankProviderTelemetry',
    entityId: String(overrides.subject_id ?? id),
    createdAt: options.createdAt ?? new Date('2026-05-21T10:00:00.000Z'),
    details: {
      event_name: ThinkTankEventName.ProviderCallCompleted,
      event_version: THINKTANK_EVENT_VERSION,
      tenant_id: currentTenantId,
      actor_id: actor.id,
      subject_type: 'provider_call',
      subject_id: id,
      outcome: 'success',
      occurred_at: '2026-05-21T10:00:00.000Z',
      correlation_id: `corr-${id}`,
      privacy_classification: 'operational',
      provider: 'zhipu-glm',
      workflow_type: 'quick-consult',
      latency_ms: 120,
      estimated_tokens: 42,
      estimated_cost: 0.12,
      input_tokens: 30,
      output_tokens: 12,
      total_tokens: 42,
      ...overrides,
    },
  }
}

describe('AdvisoryOperationsController HTTP route', () => {
  let app: INestApplication
  const auditLogSource = {
    findThinkTankUsageEvents: jest.fn(),
    findThinkTankProviderTelemetryEvents: jest.fn(),
  }

  async function createApp(options?: { authenticated?: boolean; roleAllowed?: boolean }) {
    const authenticated = options?.authenticated ?? true
    const roleAllowed = options?.roleAllowed ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdvisoryOperationsController],
      providers: [
        AdvisoryOperationsService,
        AdvisoryProviderTelemetryService,
        {
          provide: AuditLogService,
          useValue: auditLogSource,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): Record<string, unknown> } }) => {
          if (!authenticated) {
            throw new UnauthorizedException('User not authenticated')
          }
          context.switchToHttp().getRequest().user = actor
          return true
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): Record<string, unknown> } }) => {
          context.switchToHttp().getRequest().tenantId = currentTenantId
          return true
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => roleAllowed,
      })
      .compile()

    const testApp = moduleFixture.createNestApplication()
    await testApp.init()
    return testApp
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    auditLogSource.findThinkTankUsageEvents.mockResolvedValue([
      auditLog('session-1', { prompt: rawConversation }),
      auditLog('session-1-complete', {
        event_name: ThinkTankEventName.WorkflowCompleted,
        subject_id: 'session-1',
        report: rawConversation,
      }),
      auditLog('quick-1', {
        event_name: ThinkTankEventName.QuickConsultStarted,
        subject_type: 'quick_consult',
        subject_id: 'quick-1',
        message: rawConversation,
      }),
    ])
    auditLogSource.findThinkTankProviderTelemetryEvents.mockResolvedValue([
      providerTelemetryAuditLog('provider-call-1', {
        subject_type: 'quick_consult',
        quick_consult: true,
      }),
      providerTelemetryAuditLog('raw-provider-payload', {
        event_name: ThinkTankEventName.ProviderCallFailed,
        outcome: 'failure',
        prompt: rawProviderPayload,
      }),
    ])
    app = await createApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('[P1][6.1-API-007][AC1,AC4] serves GET /advisory/admin/operations/usage with query filters and data envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/advisory/admin/operations/usage')
      .query({
        tenantId: currentTenantId,
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-22T23:59:59.999Z',
        workflowType: 'problem-solving',
      })
      .expect(200)

    expect(response.body).toEqual({ data: expect.any(Object) })
    expect(response.body.data.appliedFilters).toEqual({
      tenantId: currentTenantId,
      dateFrom: '2026-05-01T00:00:00.000Z',
      dateTo: '2026-05-22T23:59:59.999Z',
      workflowType: 'problem-solving',
    })
    expect(response.body.data.summary).toEqual(
      expect.objectContaining({
        quickConsult: { started: 1, completed: 0, failed: 0, volume: 1 },
        workflows: { started: 1, completed: 1, startFailed: 0, incomplete: 0, completionRate: 1 },
        measurementStatus: 'fresh',
      }),
    )
    expect(auditLogSource.findThinkTankUsageEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: currentTenantId,
        dateFrom: new Date('2026-05-01T00:00:00.000Z'),
        dateTo: new Date('2026-05-22T23:59:59.999Z'),
      }),
    )
    expect(JSON.stringify(response.body)).not.toContain(rawConversation)
  })

  it('[P1][6.1-API-010][AC1] normalizes tenantId=current to the guarded current tenant', async () => {
    const response = await request(app.getHttpServer())
      .get('/advisory/admin/operations/usage')
      .query({
        tenantId: 'current',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-22',
      })
      .expect(200)

    expect(response.body.data.appliedFilters.tenantId).toBe(currentTenantId)
    expect(auditLogSource.findThinkTankUsageEvents).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: currentTenantId }),
    )
  })

  it('[P1][6.2-API-014][AC1,AC2] serves GET /advisory/admin/operations/provider-telemetry as aggregate-only data', async () => {
    const response = await request(app.getHttpServer())
      .get('/advisory/admin/operations/provider-telemetry')
      .query({
        tenantId: 'current',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-22',
        groupBy: 'workflow,experience,provider',
      })
      .expect(200)

    expect(response.body).toEqual({ data: expect.any(Object) })
    expect(response.body.data.appliedFilters).toEqual(
      expect.objectContaining({
        tenantId: currentTenantId,
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-22T23:59:59.999Z',
        groupBy: ['workflow', 'experience', 'provider'],
      }),
    )
    expect(response.body.data.summary).toEqual(
      expect.objectContaining({
        terminalCalls: 1,
        successfulCalls: 1,
        failedCalls: 0,
        estimatedTokens: 42,
        estimatedCost: 0.12,
      }),
    )
    expect(response.body.data.byExperience).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ experience: 'quick_consult', terminalCalls: 1 }),
      ]),
    )
    expect(auditLogSource.findThinkTankProviderTelemetryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: currentTenantId,
        dateFrom: new Date('2026-05-01T00:00:00.000Z'),
        dateTo: new Date('2026-05-22T23:59:59.999Z'),
      }),
    )
    expect(response.body.data.instrumentationGaps).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: 'privacy_unsafe_payload' })]),
    )
    expect(JSON.stringify(response.body)).not.toContain(rawProviderPayload)
  })

  it('[P0][6.2-API-015][AC2] rejects foreign tenant provider telemetry filters before reading rows', async () => {
    await request(app.getHttpServer())
      .get('/advisory/admin/operations/provider-telemetry')
      .query({ tenantId: otherTenantId })
      .expect(403)

    expect(auditLogSource.findThinkTankProviderTelemetryEvents).not.toHaveBeenCalled()
  })

  it('[P1][6.2-API-016][AC2] rejects malformed provider telemetry date and grouping filters at the route', async () => {
    await request(app.getHttpServer())
      .get('/advisory/admin/operations/provider-telemetry')
      .query({ dateFrom: 'not-a-date', dateTo: '2026-05-22' })
      .expect(400)

    await request(app.getHttpServer())
      .get('/advisory/admin/operations/provider-telemetry')
      .query({ dateFrom: '2026-05-23', dateTo: '2026-05-22' })
      .expect(400)

    await request(app.getHttpServer())
      .get('/advisory/admin/operations/provider-telemetry')
      .query({ dateFrom: '2026-02-31', dateTo: '2026-05-22' })
      .expect(400)

    await request(app.getHttpServer())
      .get('/advisory/admin/operations/provider-telemetry')
      .query({ dateFrom: '2026-01-01', dateTo: '2026-05-22' })
      .expect(400)

    await request(app.getHttpServer())
      .get('/advisory/admin/operations/provider-telemetry')
      .query({ dateFrom: ['2026-05-01', '2026-05-02'], dateTo: '2026-05-22' })
      .expect(400)

    await request(app.getHttpServer())
      .get('/advisory/admin/operations/provider-telemetry')
      .query({ groupBy: 'workflow,bogus' })
      .expect(400)

    expect(auditLogSource.findThinkTankProviderTelemetryEvents).not.toHaveBeenCalled()
  })

  it('[P1][6.2-API-017][AC2] returns unavailable provider telemetry freshness when the source fails', async () => {
    auditLogSource.findThinkTankProviderTelemetryEvents.mockRejectedValueOnce(
      new Error('audit store unavailable'),
    )

    const response = await request(app.getHttpServer())
      .get('/advisory/admin/operations/provider-telemetry')
      .query({ dateFrom: '2026-05-01', dateTo: '2026-05-22' })
      .expect(200)

    expect(response.body.data.summary.measurementStatus).toBe('unavailable')
    expect(response.body.data.summary.errorRate).toBeNull()
    expect(response.body.data.summary.timeoutRate).toBeNull()
    expect(response.body.data.freshness).toEqual(
      expect.objectContaining({
        source: 'audit_logs',
        status: 'unavailable',
      }),
    )
    expect(response.body.data.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'telemetry_source_unavailable', source: 'audit_logs' }),
      ]),
    )
    expect(JSON.stringify(response.body)).not.toContain(rawProviderPayload)
  })

  it('[P0][6.1-API-011][AC1] rejects foreign tenant filters before reading usage events', async () => {
    await request(app.getHttpServer())
      .get('/advisory/admin/operations/usage')
      .query({ tenantId: otherTenantId })
      .expect(403)

    expect(auditLogSource.findThinkTankUsageEvents).not.toHaveBeenCalled()
  })

  it('[P1][6.1-API-012][AC1] rejects malformed and inverted date windows at the endpoint', async () => {
    await request(app.getHttpServer())
      .get('/advisory/admin/operations/usage')
      .query({ dateFrom: 'not-a-date', dateTo: '2026-05-22' })
      .expect(400)

    await request(app.getHttpServer())
      .get('/advisory/admin/operations/usage')
      .query({ dateFrom: '2026-05-23', dateTo: '2026-05-22' })
      .expect(400)

    expect(auditLogSource.findThinkTankUsageEvents).not.toHaveBeenCalled()
  })

  it('[P1][6.1-API-013][AC4] returns unavailable freshness without trusted completion rates when the source fails', async () => {
    auditLogSource.findThinkTankUsageEvents.mockRejectedValueOnce(
      new Error('audit store unavailable'),
    )

    const response = await request(app.getHttpServer())
      .get('/advisory/admin/operations/usage')
      .query({ dateFrom: '2026-05-01', dateTo: '2026-05-22' })
      .expect(200)

    expect(response.body.data.summary.measurementStatus).toBe('unavailable')
    expect(response.body.data.summary.workflows.completionRate).toBeNull()
    expect(response.body.data.freshness).toEqual(
      expect.objectContaining({
        source: 'audit_logs',
        status: 'unavailable',
      }),
    )
    expect(response.body.data.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'telemetry_source_unavailable', source: 'audit_logs' }),
      ]),
    )
  })

  it('[P1][6.1-API-008][AC1] returns 401 before serving anonymous operations usage requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer()).get('/advisory/admin/operations/usage').expect(401)
    expect(auditLogSource.findThinkTankUsageEvents).not.toHaveBeenCalled()
  })

  it('[P1][6.1-API-009][AC1] returns 403 when role guard denies operations usage access', async () => {
    await app.close()
    app = await createApp({ roleAllowed: false })

    await request(app.getHttpServer()).get('/advisory/admin/operations/usage').expect(403)
    expect(auditLogSource.findThinkTankUsageEvents).not.toHaveBeenCalled()
  })

  it('[P1][6.2-API-018][AC2] returns 401 before serving anonymous provider telemetry requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer())
      .get('/advisory/admin/operations/provider-telemetry')
      .expect(401)
    expect(auditLogSource.findThinkTankProviderTelemetryEvents).not.toHaveBeenCalled()
  })

  it('[P1][6.2-API-019][AC2] returns 403 when role guard denies provider telemetry access', async () => {
    await app.close()
    app = await createApp({ roleAllowed: false })

    await request(app.getHttpServer())
      .get('/advisory/admin/operations/provider-telemetry')
      .expect(403)
    expect(auditLogSource.findThinkTankProviderTelemetryEvents).not.toHaveBeenCalled()
  })
})
