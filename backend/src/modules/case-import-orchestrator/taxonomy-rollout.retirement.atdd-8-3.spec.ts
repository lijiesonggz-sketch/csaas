import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { DomainRolloutPolicyService } from './services/taxonomy-classification/domain-rollout-policy.service'
import { TaxonomyDomainGateService } from './services/taxonomy-domain-gate.service'
import { TaxonomyDomainRetirementService } from './services/taxonomy-domain-retirement.service'
import { AuditLogService } from '../audit/audit-log.service'

const VALID_TENANT_ID = 'tenant-test-001'
const VALID_ADMIN_USER_ID = '00000000-0000-0000-0000-000000000111'

type RequestContext = {
  tenantId: string
  userId: string
  authenticated: boolean
  role: string
}

function buildHeaders(context?: Partial<RequestContext>): Record<string, string> {
  const effectiveContext = {
    tenantId: VALID_TENANT_ID,
    userId: VALID_ADMIN_USER_ID,
    authenticated: true,
    role: 'admin',
    ...context,
  }

  return {
    'x-test-authenticated': String(effectiveContext.authenticated),
    'x-test-role': effectiveContext.role,
    'x-test-tenant-id': effectiveContext.tenantId,
    'x-test-user-id': effectiveContext.userId,
  }
}

describe('Story 8.3 - taxonomy rollout retirement routes (ATDD RED PHASE)', () => {
  let app: INestApplication

  const mockDomainRolloutPolicyService = {
    findByL1Code: jest.fn(),
    getOrCreatePolicyForDomain: jest.fn(),
  }

  const mockTaxonomyDomainGateService = {
    evaluateDomainReadiness: jest.fn(),
    transitionRolloutState: jest.fn(),
  }

  const mockTaxonomyDomainRetirementService = {
    evaluateRetirementReadiness: jest.fn(),
    evaluateRetirementDryRun: jest.fn(),
    executeRetirement: jest.fn(),
    rollbackRetirement: jest.fn(),
    evaluatePhysicalCleanup: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(): Promise<INestApplication> {
    const { TaxonomyRolloutController } = await import('./controllers/taxonomy-rollout.controller')

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TaxonomyRolloutController],
      providers: [
        {
          provide: DomainRolloutPolicyService,
          useValue: mockDomainRolloutPolicyService,
        },
        {
          provide: TaxonomyDomainGateService,
          useValue: mockTaxonomyDomainGateService,
        },
        {
          provide: TaxonomyDomainRetirementService,
          useValue: mockTaxonomyDomainRetirementService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx) => {
          const req = ctx.switchToHttp().getRequest()
          const headers = req.headers
          if (headers['x-test-authenticated'] === 'false') return false
          req.user = { id: headers['x-test-user-id'], role: headers['x-test-role'] }
          return true
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (ctx) => {
          const req = ctx.switchToHttp().getRequest()
          req.tenantId = req.headers['x-test-tenant-id']
          return true
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: (ctx) => {
          const req = ctx.switchToHttp().getRequest()
          return req.user?.role === 'admin'
        },
      })
      .compile()

    const nestApp = moduleFixture.createNestApplication()
    nestApp.useGlobalPipes(new ValidationPipe({ transform: true }))
    nestApp.useGlobalInterceptors(new TransformInterceptor())
    await nestApp.init()
    return nestApp
  }

  beforeAll(async () => {
    app = await createApp()
  })

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('[8.3-ROUTE-001][P0] should return structured retirement readiness from dry-run route', async () => {
    mockDomainRolloutPolicyService.getOrCreatePolicyForDomain.mockResolvedValue({
      l1Code: 'IT07',
      rolloutState: 'domain-primary',
      allowLegacyFallback: true,
      killSwitchEnabled: false,
      activeClassifierVersion: 'taxonomy-classifier-6.6',
      primaryThreshold: 0.78,
      shadowWindowDays: 14,
      stateChangedAt: new Date('2026-05-02T00:00:00.000Z'),
      retirementEvidenceJson: {
        lastLegacyOffAt: null,
        lastLegacyOffReleaseId: null,
        lastSmokeVerifiedAt: '2026-05-02T08:20:00.000Z',
        lastRollbackVerifiedAt: null,
        lastRetirementReportPath: '/reports/it07-retirement.json',
      },
    } as any)
    mockTaxonomyDomainRetirementService.evaluateRetirementDryRun.mockResolvedValue({
      l1Code: 'IT07',
      currentState: 'domain-primary',
      targetState: 'legacy-off',
      allowed: false,
      gateStatus: 'FAIL',
      prerequisites: {
        cutoverTierPassed: true,
        observationWindowPassed: true,
        killSwitchDrillPassed: true,
        rollbackVerified: false,
        reclassifyReady: true,
        backfillReady: false,
      },
      blockingReasons: [
        'rollback readiness has not been verified',
        'backfill readiness has not been verified',
      ],
      rolloutGuidance: {
        rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
      },
      recommendedNextAction: 'Verify rollback and backfill readiness before retiring IT07.',
      policySummary: {
        l1Code: 'IT07',
        rolloutState: 'domain-primary',
        killSwitchEnabled: false,
        allowLegacyFallback: true,
      },
      cleanupReadiness: {
        allowed: false,
        blockingReasons: ['domain-primary stable window has not elapsed'],
      },
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/retirement/dry-run')
      .set(buildHeaders())
      .send({ l1Code: 'IT07' })
      .expect(200)

    expect(response.body.data).toMatchObject({
      l1Code: 'IT07',
      currentState: 'domain-primary',
      targetState: 'legacy-off',
      gateStatus: 'FAIL',
      prerequisites: {
        cutoverTierPassed: true,
        observationWindowPassed: true,
        killSwitchDrillPassed: true,
        rollbackVerified: false,
        reclassifyReady: true,
        backfillReady: false,
      },
      blockingReasons: [
        'rollback readiness has not been verified',
        'backfill readiness has not been verified',
      ],
      rolloutGuidance: {
        rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
      },
    })
  })

  test('[8.3-ROUTE-002][P0] should execute legacy-off and return smoke report and cleanup summary', async () => {
    mockDomainRolloutPolicyService.getOrCreatePolicyForDomain
      .mockResolvedValueOnce({
        l1Code: 'IT04',
        rolloutState: 'domain-primary',
        allowLegacyFallback: true,
        killSwitchEnabled: false,
        activeClassifierVersion: 'taxonomy-classifier-6.6',
        primaryThreshold: 0.7,
        shadowWindowDays: 14,
        stateChangedAt: null,
      } as any)
      .mockResolvedValueOnce({
        l1Code: 'IT04',
        rolloutState: 'legacy-off',
        allowLegacyFallback: false,
        killSwitchEnabled: false,
        activeClassifierVersion: 'taxonomy-classifier-6.6',
        primaryThreshold: 0.7,
        shadowWindowDays: 14,
        stateChangedAt: new Date('2026-05-03T02:10:00.000Z'),
      } as any)
    mockTaxonomyDomainRetirementService.executeRetirement.mockResolvedValue({
      gateResults: {
        legacyOff: 'PASS',
        cleanup: 'DEFERRED',
      },
      l1Code: 'IT04',
      previousState: 'domain-primary',
      targetState: 'legacy-off',
      stateChangedAt: '2026-05-03T02:10:00.000Z',
      operator: VALID_ADMIN_USER_ID,
      smokeVerification: {
        passed: true,
        checkedAt: '2026-05-03T02:10:15.000Z',
      },
      reportPath: '/reports/taxonomy-retirement/IT04-kg-v2-r3.json',
      finalFallbackRate: 0.0087,
      cleanupReadiness: {
        allowed: false,
        blockingReasons: ['first non-IT04 cleanup requires a separate release'],
      },
      rollbackReadiness: {
        verified: true,
        path: 'Enable kill switch and revert rollout state to domain-primary',
      },
      auditSummary: {
        updatedBy: VALID_ADMIN_USER_ID,
        releaseId: 'kg-v2-r3',
      },
      policySummary: {
        l1Code: 'IT04',
        rolloutState: 'legacy-off',
        killSwitchEnabled: false,
        allowLegacyFallback: false,
      },
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/retirement/execute')
      .set(buildHeaders())
      .send({
        l1Code: 'IT04',
        releaseId: 'kg-v2-r3',
        confirmationText: 'IT04',
      })
      .expect(200)

    expect(response.body.data).toMatchObject({
      l1Code: 'IT04',
      previousState: 'domain-primary',
      targetState: 'legacy-off',
      operator: VALID_ADMIN_USER_ID,
      smokeVerification: {
        passed: true,
      },
      reportPath: '/reports/taxonomy-retirement/IT04-kg-v2-r3.json',
      finalFallbackRate: 0.0087,
      cleanupReadiness: {
        allowed: false,
      },
      auditSummary: {
        updatedBy: VALID_ADMIN_USER_ID,
        releaseId: 'kg-v2-r3',
      },
      policySummary: {
        l1Code: 'IT04',
        rolloutState: 'legacy-off',
        allowLegacyFallback: false,
      },
    })
  })

  test('[8.3-ROUTE-003][P0] should rollback a retired domain through the formal rollback contract', async () => {
    mockDomainRolloutPolicyService.getOrCreatePolicyForDomain.mockResolvedValue({
      l1Code: 'IT04',
      rolloutState: 'domain-primary',
      allowLegacyFallback: true,
      killSwitchEnabled: false,
      activeClassifierVersion: 'taxonomy-classifier-6.6',
      primaryThreshold: 0.7,
      shadowWindowDays: 14,
      stateChangedAt: new Date('2026-05-03T02:15:00.000Z'),
    } as any)
    mockTaxonomyDomainRetirementService.rollbackRetirement.mockResolvedValue({
      l1Code: 'IT04',
      previousState: 'legacy-off',
      targetState: 'domain-primary',
      stateChangedAt: '2026-05-03T02:15:00.000Z',
      operator: VALID_ADMIN_USER_ID,
      legacyFallbackRestored: true,
      rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
      evidenceSummary: {
        lastRetirementReportPath: '/reports/taxonomy-retirement/IT04-kg-v2-r3.json',
        lastRollbackVerifiedAt: '2026-05-02T08:00:00.000Z',
      },
      policySummary: {
        l1Code: 'IT04',
        rolloutState: 'domain-primary',
        allowLegacyFallback: true,
        killSwitchEnabled: false,
      },
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/retirement/rollback')
      .set(buildHeaders())
      .send({
        l1Code: 'IT04',
        targetState: 'domain-primary',
        confirmationText: 'IT04',
      })
      .expect(200)

    expect(response.body.data).toMatchObject({
      l1Code: 'IT04',
      previousState: 'legacy-off',
      targetState: 'domain-primary',
      legacyFallbackRestored: true,
      rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
      policySummary: {
        l1Code: 'IT04',
        rolloutState: 'domain-primary',
        allowLegacyFallback: true,
      },
    })
  })

  test('[8.3-ROUTE-004][P1] should reject execute requests missing releaseId or confirmation payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/retirement/execute')
      .set(buildHeaders())
      .send({
        l1Code: 'IT04',
      })
      .expect(400)

    expect(response.body.message.join(' ')).toContain('releaseId')
  })

  test('[8.3-ROUTE-005][P1] should surface blocked retirement execution as a conflict with operator-readable reasons', async () => {
    mockTaxonomyDomainRetirementService.executeRetirement.mockRejectedValue(
      new ConflictException('Retirement blocked: rollback readiness has not been verified'),
    )

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/retirement/execute')
      .set(buildHeaders())
      .send({
        l1Code: 'IT07',
        releaseId: 'kg-v2-r4',
        confirmationText: 'IT07',
      })
      .expect(409)

    expect(response.body.message).toContain('Retirement blocked')
  })
})
