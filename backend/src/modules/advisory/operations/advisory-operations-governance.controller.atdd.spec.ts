import { INestApplication, UnauthorizedException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { UserRole } from '../../../database/entities/user.entity'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'

const currentTenantId = '660e8400-e29b-41d4-a716-446655440000'
const otherTenantId = '111e8400-e29b-41d4-a716-446655440000'
const governanceServiceModulePath = './advisory-governance.service'
const actor = {
  id: '770e8400-e29b-41d4-a716-446655440000',
  role: UserRole.ADMIN,
  tenantId: currentTenantId,
  organizationId: null,
}

const governanceDashboard = {
  generatedAt: '2026-05-23T04:15:00.000Z',
  appliedFilters: {
    tenantId: currentTenantId,
    dateFrom: '2026-05-01T00:00:00.000Z',
    dateTo: '2026-05-22T23:59:59.999Z',
    workflowType: 'problem-solving',
    actorId: actor.id,
    eventType: 'thinktank.output.exported',
    outcome: 'success',
    groupBy: ['eventType', 'outcome', 'actor', 'workflow'],
  },
  summary: {
    measurementStatus: 'fresh',
    totalEvents: 3,
    trustedEvents: 3,
    malformedEvents: 0,
    deniedActions: 0,
    exportedOutputs: 1,
    exportsMissingAiLabelMetadata: 0,
    complianceIssueCount: 0,
    trustedEventRate: 1,
    exportsMissingAiLabelRate: 0,
  },
  byEventType: [],
  byOutcome: [],
  byActor: [],
  byWorkflow: [],
  exportedOutputs: [],
  complianceIssues: [],
  instrumentationGaps: [],
  freshness: {
    source: 'audit_logs',
    status: 'fresh',
    latestEventAt: '2026-05-22T08:10:00.000Z',
    description: 'Governance review is current.',
  },
}

describe('Story 6.5 governance operations route ATDD (RED)', () => {
  let app: INestApplication
  const governanceService = {
    getGovernanceReview: jest.fn(),
  }

  async function createApp(options?: { authenticated?: boolean; roleAllowed?: boolean }) {
    const { AdvisoryOperationsController } = await import('./advisory-operations.controller')
    const { AdvisoryOperationsService } = await import('./advisory-operations.service')
    const { AdvisoryProviderTelemetryService } =
      await import('./advisory-provider-telemetry.service')
    const { AdvisoryQualityFeedbackService } = await import('./advisory-quality-feedback.service')
    const { AdvisoryGovernanceService } = await import(governanceServiceModulePath)
    const { AuditLogService } = await import('../../audit/audit-log.service')
    const authenticated = options?.authenticated ?? true
    const roleAllowed = options?.roleAllowed ?? true
    const auditLogSource = {
      findThinkTankUsageEvents: jest.fn(),
      findThinkTankProviderTelemetryEvents: jest.fn(),
      findThinkTankGovernanceEvents: jest.fn(),
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdvisoryOperationsController],
      providers: [
        AdvisoryOperationsService,
        AdvisoryProviderTelemetryService,
        {
          provide: AdvisoryQualityFeedbackService,
          useValue: { getQualityFeedback: jest.fn() },
        },
        {
          provide: AdvisoryGovernanceService,
          useValue: governanceService,
        },
        {
          provide: AuditLogService,
          useValue: auditLogSource,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): Record<string, unknown> } }) => {
          if (!authenticated) throw new UnauthorizedException('User not authenticated')
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
      .useValue({ canActivate: () => roleAllowed })
      .compile()

    const testApp = moduleFixture.createNestApplication()
    await testApp.init()
    return testApp
  }

  beforeEach(() => {
    jest.clearAllMocks()
    governanceService.getGovernanceReview.mockResolvedValue(governanceDashboard)
  })

  afterEach(async () => {
    if (app) await app.close()
  })

  it('[6.5-API-001][P0][AC1,AC2,AC3,AC4] serves GET /advisory/admin/operations/governance with data envelope and safe filters', async () => {
    app = await createApp()

    const response = await request(app.getHttpServer())
      .get('/advisory/admin/operations/governance')
      .query({
        tenantId: 'current',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-22',
        workflowType: 'problem-solving',
        actorId: actor.id,
        eventType: 'thinktank.output.exported',
        outcome: 'success',
        groupBy: 'eventType,outcome,actor,workflow',
      })
      .expect(200)

    expect(response.body).toEqual({ data: governanceDashboard })
    expect(governanceService.getGovernanceReview).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        currentTenantId,
        tenantId: currentTenantId,
        dateFrom: '2026-05-01',
        dateTo: '2026-05-22',
        workflowType: 'problem-solving',
        actorId: actor.id,
        eventType: 'thinktank.output.exported',
        outcome: 'success',
        groupBy: ['eventType', 'outcome', 'actor', 'workflow'],
      }),
    )
    expect(JSON.stringify(response.body)).not.toMatch(
      /PRIVATE_|raw.*(conversation|prompt|report)|provider payload|cache key/i,
    )
  })

  it('[6.5-API-002][P0][AC1] rejects foreign tenant governance filters before service read', async () => {
    app = await createApp()

    await request(app.getHttpServer())
      .get('/advisory/admin/operations/governance')
      .query({ tenantId: otherTenantId })
      .expect(403)

    expect(governanceService.getGovernanceReview).not.toHaveBeenCalled()
  })

  it('[6.5-API-003][P1][AC1,AC3] rejects malformed dates and invalid or duplicate group filters', async () => {
    app = await createApp()

    await request(app.getHttpServer())
      .get('/advisory/admin/operations/governance')
      .query({ dateFrom: 'not-a-date', dateTo: '2026-05-22' })
      .expect(400)
    await request(app.getHttpServer())
      .get('/advisory/admin/operations/governance')
      .query({ dateFrom: '2026-05-23', dateTo: '2026-05-22' })
      .expect(400)
    await request(app.getHttpServer())
      .get('/advisory/admin/operations/governance')
      .query({ groupBy: 'eventType,bogus' })
      .expect(400)
    await request(app.getHttpServer())
      .get('/advisory/admin/operations/governance')
      .query({ groupBy: ['eventType', 'outcome'] })
      .expect(400)

    expect(governanceService.getGovernanceReview).not.toHaveBeenCalled()
  })

  it('[6.5-API-005][P0][AC1,AC4] rejects unsafe governance filter values before service read', async () => {
    app = await createApp()

    await request(app.getHttpServer())
      .get('/advisory/admin/operations/governance')
      .query({ actorId: 'PRIVATE_CONVERSATION_DO_NOT_RENDER' })
      .expect(400)
    await request(app.getHttpServer())
      .get('/advisory/admin/operations/governance')
      .query({ eventType: 'thinktank.output.exported.prompt' })
      .expect(400)
    await request(app.getHttpServer())
      .get('/advisory/admin/operations/governance')
      .query({ outcome: 'report content' })
      .expect(400)

    expect(governanceService.getGovernanceReview).not.toHaveBeenCalled()
  })

  it('[6.5-API-004][P1][AC1] enforces authentication and admin role before governance data is served', async () => {
    app = await createApp({ authenticated: false })
    await request(app.getHttpServer()).get('/advisory/admin/operations/governance').expect(401)
    await app.close()

    app = await createApp({ roleAllowed: false })
    await request(app.getHttpServer()).get('/advisory/admin/operations/governance').expect(403)
    expect(governanceService.getGovernanceReview).not.toHaveBeenCalled()
  })
})
