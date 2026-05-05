import {
  BadRequestException,
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { ComplianceCaseBackfillService } from './services/compliance-case-backfill.service'
import { ComplianceCaseReclassificationService } from './services/compliance-case-reclassification.service'
import { DomainRolloutPolicyService } from './services/taxonomy-classification/domain-rollout-policy.service'
import { TaxonomyDomainGateService } from './services/taxonomy-domain-gate.service'
import { TaxonomyDomainRetirementService } from './services/taxonomy-domain-retirement.service'

const VALID_TENANT_ID = 'tenant-test-001'
const VALID_ADMIN_USER_ID = '00000000-0000-0000-0000-000000000111'

function buildHeaders(): Record<string, string> {
  return {
    'x-test-authenticated': 'true',
    'x-test-role': 'admin',
    'x-test-tenant-id': VALID_TENANT_ID,
    'x-test-user-id': VALID_ADMIN_USER_ID,
  }
}

describe('Story 8.4 - taxonomy rollout recovery routes', () => {
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
    readRetirementReport: jest.fn(),
  }
  const mockComplianceCaseReclassificationService = {
    reclassify: jest.fn(),
  }
  const mockComplianceCaseBackfillService = {
    backfill: jest.fn(),
  }
  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
    logStrict: jest.fn().mockResolvedValue(undefined),
    findTaxonomyRolloutReports: jest.fn(),
  }

  async function createApp(): Promise<INestApplication> {
    const { TaxonomyRolloutController } = await import('./controllers/taxonomy-rollout.controller')

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TaxonomyRolloutController],
      providers: [
        { provide: DomainRolloutPolicyService, useValue: mockDomainRolloutPolicyService },
        { provide: TaxonomyDomainGateService, useValue: mockTaxonomyDomainGateService },
        { provide: TaxonomyDomainRetirementService, useValue: mockTaxonomyDomainRetirementService },
        {
          provide: ComplianceCaseReclassificationService,
          useValue: mockComplianceCaseReclassificationService,
        },
        { provide: ComplianceCaseBackfillService, useValue: mockComplianceCaseBackfillService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx) => {
          const req = ctx.switchToHttp().getRequest()
          req.user = { id: req.headers['x-test-user-id'], role: req.headers['x-test-role'] }
          return req.headers['x-test-authenticated'] !== 'false'
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
        canActivate: (ctx) => ctx.switchToHttp().getRequest().user?.role === 'admin',
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

  test('[8.4-ROUTE-001][P0] should dry-run reclassification through the formal recovery endpoint', async () => {
    mockComplianceCaseReclassificationService.reclassify.mockResolvedValue({
      dryRun: true,
      latestPointerUpdated: false,
      caseCount: 2,
      affectedDomains: ['IT04'],
      classifierVersion: 'taxonomy-classifier-8.4-dry-run',
      scope: {
        batchId: 'batch-it04-2026-05-05',
        caseIds: ['case-it04-001', 'case-it04-002'],
        l1Code: 'IT04',
        shadowOnly: true,
        forceLatestPointer: false,
      },
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/reclassify')
      .set(buildHeaders())
      .send({
        l1Code: 'IT04',
        batchId: 'batch-it04-2026-05-05',
        classifierVersion: 'taxonomy-classifier-8.4-dry-run',
        shadowOnly: true,
        dryRun: true,
      })
      .expect(200)

    expect(mockComplianceCaseReclassificationService.reclassify).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT04',
        batchId: 'batch-it04-2026-05-05',
        classifierVersion: 'taxonomy-classifier-8.4-dry-run',
        shadowOnly: true,
        dryRun: true,
      }),
    )
    expect(response.body.data).toMatchObject({
      operation: 'reclassify',
      l1Code: 'IT04',
      dryRun: true,
      processedCount: 2,
      affectedDomains: ['IT04'],
      latestPointerUpdated: false,
      classifierVersion: 'taxonomy-classifier-8.4-dry-run',
      auditSummary: { updatedBy: VALID_ADMIN_USER_ID, outcome: 'success' },
    })
    expect(response.body.data.reportPath).toMatch(/^\/reports\/taxonomy-recovery\/reclassify\//)
  })

  test('[8.4-ROUTE-002][P0] should execute reclassification and return latest pointer and classifier summary', async () => {
    mockComplianceCaseReclassificationService.reclassify.mockResolvedValue({
      dryRun: false,
      latestPointerUpdated: true,
      caseCount: 3,
      affectedDomains: ['IT07'],
      classifierVersion: 'taxonomy-classifier-8.4-execute',
      scope: {
        batchId: null,
        caseIds: ['case-it07-101', 'case-it07-102', 'case-it07-103'],
        l1Code: 'IT07',
        shadowOnly: false,
        forceLatestPointer: true,
      },
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/reclassify')
      .set(buildHeaders())
      .send({
        l1Code: 'IT07',
        caseIds: ['case-it07-101', 'case-it07-102', 'case-it07-103'],
        classifierVersion: 'taxonomy-classifier-8.4-execute',
        shadowOnly: false,
        dryRun: false,
        confirmationText: 'IT07',
      })
      .expect(200)

    expect(response.body.data).toMatchObject({
      operation: 'reclassify',
      dryRun: false,
      processedCount: 3,
      affectedDomains: ['IT07'],
      latestPointerUpdated: true,
      classifierVersion: 'taxonomy-classifier-8.4-execute',
      scope: { caseIds: ['case-it07-101', 'case-it07-102', 'case-it07-103'] },
    })
  })

  test('[8.4-ROUTE-003][P0] should dry-run backfill through ComplianceCaseBackfillService without mutating maps', async () => {
    mockComplianceCaseBackfillService.backfill.mockResolvedValue({
      requestedCount: 4,
      resetCount: 3,
      skippedReviewedCount: 1,
      skippedMissingBatchCount: 0,
      extractedCount: 0,
      clusteredCount: 0,
      autoMappedCaseCount: 0,
      unmappedCaseCount: 0,
      ruleMappedCaseCount: 0,
      llmTriggeredCaseCount: 0,
      llmAssistedRuleCaseCount: 0,
      llmFallbackCaseCount: 0,
      llmUnmappedCaseCount: 0,
      mapCountBySource: {},
      mappedCaseCountBySource: {},
      batchIds: ['batch-it05-2026-05-05'],
      affectedDomains: ['IT05'],
      rollbackCompatible: true,
      requiresLegacyCodeRestore: false,
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/backfill')
      .set(buildHeaders())
      .send({ l1Code: 'IT05', batchId: 'batch-it05-2026-05-05', dryRun: true })
      .expect(200)

    expect(mockComplianceCaseBackfillService.backfill).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT05',
        batchId: 'batch-it05-2026-05-05',
        dryRun: true,
      }),
    )
    expect(response.body.data).toMatchObject({
      operation: 'backfill',
      dryRun: true,
      processedCount: 4,
      affectedDomains: ['IT05'],
      latestPointerUpdated: false,
      classifierVersion: null,
      backfillSummary: {
        requestedCount: 4,
        resetCount: 3,
        skippedReviewedCount: 1,
        rollbackCompatible: true,
      },
    })
  })

  test('[8.4-ROUTE-004][P0] should return stable conflict and audit when scoped backfill execution is blocked by service', async () => {
    const blockedMessage =
      'case/domain-scoped backfill currently supports dry-run readiness only; use reclassify for granular execution'
    mockComplianceCaseBackfillService.backfill.mockRejectedValue(
      new BadRequestException(blockedMessage),
    )

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/backfill')
      .set(buildHeaders())
      .send({ l1Code: 'IT05', caseIds: ['case-it05-009'], dryRun: false, confirmationText: 'IT05' })
      .expect(409)

    expect(response.body.message).toContain(blockedMessage)
    expect(mockAuditLogService.logStrict).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'TaxonomyRolloutRecovery',
        details: expect.objectContaining({
          operation: 'backfill',
          l1Code: 'IT05',
          dryRun: false,
          outcome: 'blocked',
        }),
      }),
    )
  })

  test('[8.4-ROUTE-005][P0] should reject missing l1Code and never call recovery services for global scope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/reclassify')
      .set(buildHeaders())
      .send({ batchId: 'batch-without-domain', dryRun: true })
      .expect(400)

    const message = Array.isArray(response.body.message)
      ? response.body.message.join(' ')
      : String(response.body.message)
    expect(message).toContain('l1Code')
    expect(mockComplianceCaseReclassificationService.reclassify).not.toHaveBeenCalled()
    expect(mockComplianceCaseBackfillService.backfill).not.toHaveBeenCalled()
  })

  test('[8.4-ROUTE-006][P0] should reject dangerous execute requests without batchId or caseIds scope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/backfill')
      .set(buildHeaders())
      .send({ l1Code: 'IT04', dryRun: false, confirmationText: 'IT04' })
      .expect(400)

    const message = Array.isArray(response.body.message)
      ? response.body.message.join(' ')
      : String(response.body.message)
    expect(message).toContain('batchId or caseIds')
    expect(mockComplianceCaseBackfillService.backfill).not.toHaveBeenCalled()
  })

  test('[8.4-ROUTE-007][P1] should return paginated report history with date filters and server-side limit clamp', async () => {
    mockAuditLogService.findTaxonomyRolloutReports.mockResolvedValue({
      items: [
        {
          id: 'audit-reclassify-001',
          type: 'reclassify',
          l1Code: 'IT04',
          occurredAt: '2026-05-04T09:15:00.000Z',
          outcome: 'success',
          summary: 'Reclassified 12 cases for IT04',
          reportPath: '/reports/taxonomy-recovery/reclassify/IT04-20260504.json',
        },
      ],
      page: 2,
      limit: 50,
      total: 118,
      hasNextPage: true,
    })

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/taxonomy-rollout/reports')
      .query({
        l1Code: 'IT04',
        page: '2',
        limit: '500',
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-05T23:59:59.999Z',
      })
      .set(buildHeaders())
      .expect(200)

    expect(mockAuditLogService.findTaxonomyRolloutReports).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT04',
        page: 2,
        limit: 50,
        dateFrom: new Date('2026-05-01T00:00:00.000Z'),
        dateTo: new Date('2026-05-05T23:59:59.999Z'),
      }),
    )
    expect(response.body.data).toMatchObject({
      page: 2,
      limit: 50,
      total: 118,
      hasNextPage: true,
      items: [{ type: 'reclassify', l1Code: 'IT04', outcome: 'success' }],
    })
  })

  test('[8.4-ROUTE-008][P0] should audit blocked reclassification and return a stable 409 conflict', async () => {
    mockComplianceCaseReclassificationService.reclassify.mockRejectedValue(
      new ConflictException(
        'Recovery operation blocked: classifier version taxonomy-classifier-deprecated is retired',
      ),
    )

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/reclassify')
      .set(buildHeaders())
      .send({
        l1Code: 'IT06',
        batchId: 'batch-it06-blocked',
        classifierVersion: 'taxonomy-classifier-deprecated',
        dryRun: false,
        confirmationText: 'IT06',
      })
      .expect(409)

    expect(response.body.message).toContain('Recovery operation blocked')
    expect(mockAuditLogService.logStrict).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: VALID_ADMIN_USER_ID,
        tenantId: VALID_TENANT_ID,
        entityType: 'TaxonomyRolloutRecovery',
        details: expect.objectContaining({
          operation: 'reclassify',
          l1Code: 'IT06',
          dryRun: false,
          classifierVersion: 'taxonomy-classifier-deprecated',
          outcome: 'blocked',
        }),
      }),
    )
  })

  test('[8.4-ROUTE-009][P2] should reject unauthenticated recovery mutations before service calls', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-rollout/reclassify')
      .set({ ...buildHeaders(), 'x-test-authenticated': 'false' })
      .send({
        l1Code: 'IT04',
        batchId: 'batch-it04-unauthenticated',
        dryRun: true,
      })
      .expect(403)

    expect(mockComplianceCaseReclassificationService.reclassify).not.toHaveBeenCalled()
    expect(mockComplianceCaseBackfillService.backfill).not.toHaveBeenCalled()
    expect(mockAuditLogService.log).not.toHaveBeenCalled()
    expect(mockAuditLogService.logStrict).not.toHaveBeenCalled()
  })

  test('[8.4-ROUTE-010][P2] should reject non-admin recovery history access before report lookup', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/taxonomy-rollout/reports')
      .query({ l1Code: 'IT04', page: '1', limit: '2' })
      .set({ ...buildHeaders(), 'x-test-role': 'user' })
      .expect(403)

    expect(mockAuditLogService.findTaxonomyRolloutReports).not.toHaveBeenCalled()
    expect(mockComplianceCaseReclassificationService.reclassify).not.toHaveBeenCalled()
    expect(mockComplianceCaseBackfillService.backfill).not.toHaveBeenCalled()
  })
})
