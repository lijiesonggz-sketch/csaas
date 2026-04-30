import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { DomainRolloutPolicyService } from './services/taxonomy-classification/domain-rollout-policy.service'

const VALID_TENANT_ID = 'tenant-test-001'
const VALID_ADMIN_USER_ID = 'admin-user-001'

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

describe('Story 8.1 - taxonomy rollout routes', () => {
  let app: INestApplication

  const mockDomainRolloutPolicyService = {
    findAll: jest.fn(),
    findByL1Code: jest.fn(),
    getReadinessSummary: jest.fn(),
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

  describe('GET /api/admin/knowledge-graph/taxonomy-rollout/policies (AC#5)', () => {
    test('[8.1-ROUTE-001][P0] should return 200 with all domain policies for admin', async () => {
      mockDomainRolloutPolicyService.findAll.mockResolvedValue([
        {
          id: 'policy-1',
          l1Code: 'IT01',
          rolloutState: 'legacy-primary',
          allowLegacyFallback: false,
          killSwitchEnabled: false,
          activeClassifierVersion: 'taxonomy-classifier-6.4',
          primaryThreshold: 0.72,
          shadowWindowDays: 14,
          stateChangedAt: '2026-01-09T00:00:00.000Z',
          updatedAt: '2026-01-15T00:00:00.000Z',
        },
        { l1Code: 'IT02', rolloutState: 'legacy-primary', killSwitchEnabled: false },
        { l1Code: 'IT03', rolloutState: 'legacy-primary', killSwitchEnabled: false },
        { l1Code: 'IT04', rolloutState: 'it04-on-new-interface', killSwitchEnabled: false },
        { l1Code: 'IT05', rolloutState: 'legacy-primary', killSwitchEnabled: false },
        { l1Code: 'IT06', rolloutState: 'legacy-primary', killSwitchEnabled: false },
        { l1Code: 'IT07', rolloutState: 'domain-compare', killSwitchEnabled: false },
        { l1Code: 'IT08', rolloutState: 'legacy-primary', killSwitchEnabled: false },
      ])
      mockDomainRolloutPolicyService.getReadinessSummary.mockImplementation((policy) => ({
        stateAllowsPrimary:
          policy.rolloutState === 'it04-on-new-interface' ||
          policy.rolloutState === 'domain-primary' ||
          policy.rolloutState === 'legacy-off',
        stateAllowsLegacyFallback: policy.rolloutState !== 'legacy-off',
        hasRetirementEvidence: false,
      }))

      const response = await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/taxonomy-rollout/policies')
        .set(buildHeaders())
        .expect(200)

      expect(response.body.data).toHaveLength(8)
      expect(response.body.data[0]).toHaveProperty('l1Code')
      expect(response.body.data[0]).toHaveProperty('rolloutState')
      expect(response.body.data[0]).toHaveProperty('allowLegacyFallback', false)
      expect(response.body.data[0]).toHaveProperty(
        'activeClassifierVersion',
        'taxonomy-classifier-6.4',
      )
      expect(response.body.data[0]).toHaveProperty('primaryThreshold', 0.72)
      expect(response.body.data[0]).toHaveProperty('shadowWindowDays', 14)
      expect(response.body.data[0]).toHaveProperty('stateChangedAt', '2026-01-09T00:00:00.000Z')
      expect(response.body.data[0]).toHaveProperty('stateAllowsPrimary')
      expect(response.body.data[0]).toHaveProperty('stateAllowsLegacyFallback')
      expect(response.body.data[0]).toHaveProperty('hasRetirementEvidence')
    })

    test('[8.1-ROUTE-002][P0] should return 403 for unauthenticated request in the guard harness', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/taxonomy-rollout/policies')
        .set(buildHeaders({ authenticated: false }))
        .expect(403)
    })

    test('[8.1-ROUTE-003][P1] should return 403 for non-admin user', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/taxonomy-rollout/policies')
        .set(buildHeaders({ role: 'consultant' }))
        .expect(403)
    })
  })

  describe('GET /api/admin/knowledge-graph/taxonomy-rollout/policies/:l1Code (AC#5)', () => {
    test('[8.1-ROUTE-004][P0] should return 200 with single domain policy detail', async () => {
      mockDomainRolloutPolicyService.findByL1Code.mockResolvedValue({
        id: 'policy-uuid-1',
        l1Code: 'IT04',
        rolloutState: 'it04-on-new-interface',
        allowLegacyFallback: true,
        killSwitchEnabled: false,
        activeClassifierVersion: 'v2.0',
        primaryThreshold: 0.7,
        shadowWindowDays: 14,
        stateChangedAt: '2026-01-15T00:00:00.000Z',
        mappingOwner: 'team-alpha',
        rulebookOwner: 'team-beta',
        benchmarkOwner: 'team-gamma',
        gateApprover: 'lead-1',
        rollbackApprover: 'lead-2',
        cutoverThresholdsJson: { canaryPercentage: 10, errorBudget: 0.02 },
        retirementThresholdsJson: { fallbackRateMax: 0.05 },
        retirementEvidenceJson: {
          lastCutoverAt: null,
          lastCutoverReleaseId: null,
          lastLegacyOffAt: null,
          lastLegacyOffReleaseId: null,
          lastKillSwitchDrillAt: '2026-01-11T00:00:00.000Z',
          lastRollbackVerifiedAt: null,
          lastReclassifyVerifiedAt: null,
          lastBackfillVerifiedAt: null,
          lastSmokeVerifiedAt: null,
          lastRetirementReportPath: '/reports/it04-retirement.json',
        },
        updatedAt: '2026-01-15T00:00:00.000Z',
      })
      mockDomainRolloutPolicyService.getReadinessSummary.mockReturnValue({
        stateAllowsPrimary: true,
        stateAllowsLegacyFallback: true,
        hasRetirementEvidence: false,
      })

      const response = await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/taxonomy-rollout/policies/IT04')
        .set(buildHeaders())
        .expect(200)

      expect(response.body.data.l1Code).toBe('IT04')
      expect(response.body.data.rolloutState).toBe('it04-on-new-interface')
      expect(response.body.data).toHaveProperty('mappingOwner')
      expect(response.body.data).toHaveProperty('cutoverThresholdsJson')
      expect(response.body.data).toHaveProperty('retirementEvidenceJson')
      expect(response.body.data).toHaveProperty('allowLegacyFallback', true)
      expect(response.body.data).toHaveProperty('activeClassifierVersion', 'v2.0')
      expect(response.body.data).toHaveProperty('primaryThreshold', 0.7)
      expect(response.body.data).toHaveProperty('shadowWindowDays', 14)
      expect(response.body.data).toHaveProperty('stateChangedAt', '2026-01-15T00:00:00.000Z')
      expect(response.body.data).toHaveProperty('updatedAt', '2026-01-15T00:00:00.000Z')
      expect(response.body.data.retirementEvidenceJson).toMatchObject({
        lastKillSwitchDrillAt: '2026-01-11T00:00:00.000Z',
        lastRetirementReportPath: '/reports/it04-retirement.json',
      })
      expect(response.body.data).toHaveProperty('stateAllowsPrimary', true)
      expect(response.body.data).toHaveProperty('stateAllowsLegacyFallback', true)
      expect(response.body.data).toHaveProperty('hasRetirementEvidence', false)
    })

    test('[8.1-ROUTE-005][P1] should return 404 for non-existent l1Code', async () => {
      mockDomainRolloutPolicyService.findByL1Code.mockResolvedValue(null)

      await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/taxonomy-rollout/policies/IT99')
        .set(buildHeaders())
        .expect(404)
    })

    test('[8.1-ROUTE-006][P1] should return 400 for malformed l1Code', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/taxonomy-rollout/policies/INVALID')
        .set(buildHeaders())
        .expect(400)
    })

    test('[8.1-ROUTE-007][P1] should return 403 for non-admin user', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/taxonomy-rollout/policies/IT04')
        .set(buildHeaders({ role: 'consultant' }))
        .expect(403)
    })

    test('[8.1-ROUTE-008][P1] should normalize lowercase and trimmed l1Code inputs before lookup', async () => {
      mockDomainRolloutPolicyService.findByL1Code.mockResolvedValue({
        id: 'policy-uuid-1',
        l1Code: 'IT04',
        rolloutState: 'it04-on-new-interface',
        allowLegacyFallback: true,
        killSwitchEnabled: false,
        activeClassifierVersion: 'v2.0',
        primaryThreshold: 0.7,
        shadowWindowDays: 14,
        stateChangedAt: '2026-01-15T00:00:00.000Z',
        mappingOwner: 'team-alpha',
        rulebookOwner: 'team-beta',
        benchmarkOwner: 'team-gamma',
        gateApprover: 'lead-1',
        rollbackApprover: 'lead-2',
        cutoverThresholdsJson: { canaryPercentage: 10 },
        retirementThresholdsJson: { fallbackRateMax: 0.05 },
        retirementEvidenceJson: { lastCutoverAt: null },
        updatedAt: '2026-01-15T00:00:00.000Z',
      })
      mockDomainRolloutPolicyService.getReadinessSummary.mockReturnValue({
        stateAllowsPrimary: true,
        stateAllowsLegacyFallback: true,
        hasRetirementEvidence: false,
      })

      await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/taxonomy-rollout/policies/%20it04%20')
        .set(buildHeaders())
        .expect(200)

      expect(mockDomainRolloutPolicyService.findByL1Code).toHaveBeenCalledWith('IT04')
    })
  })
})
