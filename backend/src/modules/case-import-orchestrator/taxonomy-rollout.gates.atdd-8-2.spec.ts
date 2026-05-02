import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { DomainRolloutPolicyService } from './services/taxonomy-classification/domain-rollout-policy.service'
import { TaxonomyDomainGateService } from './services/taxonomy-domain-gate.service'

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

describe('Story 8.2 - taxonomy rollout gate routes (ATDD RED PHASE)', () => {
  let app: INestApplication

  const mockDomainRolloutPolicyService = {
    findByL1Code: jest.fn(),
    getOrCreatePolicyForDomain: jest.fn(),
  }

  const mockTaxonomyDomainGateService = {
    evaluateDomainReadiness: jest.fn(),
    transitionRolloutState: jest.fn(),
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

  test('[8.2-ROUTE-001][P0] should return PASS gate decision with benchmark and runtime metrics', async () => {
    mockTaxonomyDomainGateService.evaluateDomainReadiness.mockResolvedValue({
      currentState: 'domain-shadow',
      targetState: 'domain-compare',
      allowed: true,
      gateStatus: 'PASS',
      blockingReasons: [],
      benchmarkGate: {
        gateStatus: 'PASS',
        sourceTier: 'tier-1-cutover',
        sourceMode: 'dual-path-compare',
      },
      metrics: {
        totalRuns: 42,
        fallbackCount: 1,
        unknownCount: 0,
        manualCorrectionCount: 1,
        fallbackRate: 0.0238,
        unknownRate: 0,
        manualCorrectionRate: 0.0238,
        errorBudgetConsumed: 0.0238,
        observationWindowDays: 14,
      },
      rolloutGuidance: {
        canaryPercentage: 10,
        errorBudget: 0.03,
        rollbackPath: 'Enable kill switch and revert rollout state',
      },
      recommendedNextAction: 'Promote to Compare',
    })
    mockDomainRolloutPolicyService.getOrCreatePolicyForDomain.mockResolvedValue({
      l1Code: 'IT07',
      rolloutState: 'domain-shadow',
      allowLegacyFallback: true,
      killSwitchEnabled: false,
      activeClassifierVersion: 'taxonomy-classifier-6.4',
      primaryThreshold: 0.78,
      shadowWindowDays: 14,
      stateChangedAt: new Date('2026-05-01T01:02:03.000Z'),
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/gates/evaluate')
      .set(buildHeaders())
      .send({ l1Code: 'IT07', targetState: 'domain-compare' })
      .expect(200)

    expect(response.body.data).toMatchObject({
      currentState: 'domain-shadow',
      targetState: 'domain-compare',
      gateStatus: 'PASS',
      benchmarkGate: { gateStatus: 'PASS' },
      metrics: {
        totalRuns: 42,
        fallbackRate: 0.0238,
        unknownRate: 0,
        manualCorrectionRate: 0.0238,
        errorBudgetConsumed: 0.0238,
        observationWindowDays: 14,
      },
      rolloutGuidance: {
        rollbackPath: 'Enable kill switch and revert rollout state',
      },
      recommendedNextAction: 'Promote to Compare',
    })
  })

  test('[8.2-ROUTE-002][P0] should return FAIL gate decision with explicit blocking reasons', async () => {
    mockTaxonomyDomainGateService.evaluateDomainReadiness.mockResolvedValue({
      currentState: 'legacy-primary',
      targetState: 'domain-shadow',
      allowed: false,
      gateStatus: 'FAIL',
      blockingReasons: [
        'benchmark gate is not PASS for target domain',
        'observation window has no runtime evidence',
      ],
      benchmarkGate: {
        gateStatus: 'FAIL',
        sourceTier: 'tier-1-cutover',
        sourceMode: 'dual-path-compare',
      },
      metrics: {
        totalRuns: 0,
        fallbackCount: 0,
        unknownCount: 0,
        manualCorrectionCount: 0,
        fallbackRate: 0,
        unknownRate: 0,
        manualCorrectionRate: 0,
        errorBudgetConsumed: 0,
        observationWindowDays: 14,
      },
      rolloutGuidance: {
        canaryPercentage: 10,
        errorBudget: 0.03,
        rollbackPath: 'Enable kill switch and revert rollout state',
      },
      recommendedNextAction: 'Keep domain on current state',
    })
    mockDomainRolloutPolicyService.getOrCreatePolicyForDomain.mockResolvedValue({
      l1Code: 'IT02',
      rolloutState: 'legacy-primary',
      allowLegacyFallback: true,
      killSwitchEnabled: false,
      activeClassifierVersion: 'taxonomy-classifier-6.4',
      primaryThreshold: 0.72,
      shadowWindowDays: 14,
      stateChangedAt: null,
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/gates/evaluate')
      .set(buildHeaders())
      .send({ l1Code: 'IT02', targetState: 'domain-shadow' })
      .expect(200)

    expect(response.body.data.gateStatus).toBe('FAIL')
    expect(response.body.data.blockingReasons).toEqual([
      'benchmark gate is not PASS for target domain',
      'observation window has no runtime evidence',
    ])
  })

  test('[8.2-ROUTE-003][P0] should reject transition when gate result is blocked', async () => {
    mockDomainRolloutPolicyService.getOrCreatePolicyForDomain.mockResolvedValue({
      l1Code: 'IT02',
      rolloutState: 'legacy-primary',
      allowLegacyFallback: true,
      killSwitchEnabled: false,
      activeClassifierVersion: 'taxonomy-classifier-6.4',
      primaryThreshold: 0.72,
      shadowWindowDays: 14,
      stateChangedAt: null,
    })
    mockTaxonomyDomainGateService.transitionRolloutState.mockRejectedValue(
      new ConflictException(
        'Rollout transition blocked: benchmark gate is not PASS for target domain',
      ),
    )

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/transitions')
      .set(buildHeaders())
      .send({ l1Code: 'IT02', targetState: 'domain-shadow' })
      .expect(409)

    expect(response.body.message).toContain('Rollout transition blocked')
    expect(mockTaxonomyDomainGateService.transitionRolloutState).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT02',
        targetState: 'domain-shadow',
        updatedBy: VALID_ADMIN_USER_ID,
      }),
    )
  })

  test('[8.2-ROUTE-004][P0] should promote allowed domain and return audit summary', async () => {
    mockTaxonomyDomainGateService.transitionRolloutState.mockResolvedValue({
      currentState: 'it04-on-new-interface',
      targetState: 'domain-shadow',
      allowed: true,
      gateStatus: 'PASS',
      blockingReasons: [],
      benchmarkGate: {
        gateStatus: 'PASS',
        sourceTier: 'tier-1-cutover',
        sourceMode: 'dual-path-compare',
      },
      metrics: {
        totalRuns: 58,
        fallbackCount: 1,
        unknownCount: 0,
        manualCorrectionCount: 1,
        fallbackRate: 0.0172,
        unknownRate: 0,
        manualCorrectionRate: 0.0172,
        errorBudgetConsumed: 0.0172,
        observationWindowDays: 14,
      },
      rolloutGuidance: {
        canaryPercentage: 10,
        errorBudget: 0.02,
        rollbackPath: 'Enable kill switch and revert rollout state',
      },
      recommendedNextAction: 'Promote to Shadow',
    })
    mockDomainRolloutPolicyService.getOrCreatePolicyForDomain
      .mockResolvedValueOnce({
        l1Code: 'IT04',
        rolloutState: 'it04-on-new-interface',
        allowLegacyFallback: true,
        killSwitchEnabled: false,
        activeClassifierVersion: 'taxonomy-classifier-6.5',
        primaryThreshold: 0.7,
        shadowWindowDays: 14,
        stateChangedAt: null,
      })
      .mockResolvedValueOnce({
        l1Code: 'IT04',
        rolloutState: 'domain-shadow',
        allowLegacyFallback: true,
        killSwitchEnabled: false,
        activeClassifierVersion: 'taxonomy-classifier-6.5',
        primaryThreshold: 0.7,
        shadowWindowDays: 14,
        stateChangedAt: new Date('2026-05-02T12:30:00.000Z'),
      })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/transitions')
      .set(buildHeaders())
      .send({ l1Code: 'IT04', targetState: 'domain-shadow', releaseId: 'rel-8-2-001' })
      .expect(200)

    expect(response.body.data).toMatchObject({
      l1Code: 'IT04',
      previousState: 'it04-on-new-interface',
      targetState: 'domain-shadow',
      operator: VALID_ADMIN_USER_ID,
      auditSummary: {
        updatedBy: VALID_ADMIN_USER_ID,
        releaseId: 'rel-8-2-001',
      },
      policySummary: {
        l1Code: 'IT04',
        rolloutState: 'domain-shadow',
      },
    })
  })

  test('[8.2-ROUTE-005][P1] should reject illegal target states outside shadow compare primary', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/transitions')
      .set(buildHeaders())
      .send({ l1Code: 'IT07', targetState: 'legacy-off' })
      .expect(400)

    expect(response.body.message[0]).toContain('targetState')
  })
})
