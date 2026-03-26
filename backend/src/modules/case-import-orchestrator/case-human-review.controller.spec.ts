import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { CaseHumanReviewController } from './controllers/case-human-review.controller'
import { CaseHumanReviewService } from './services/case-human-review.service'

describe('CaseHumanReviewController (http)', () => {
  let app: INestApplication

  const mockCaseHumanReviewService = {
    reviewCase: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(options?: { authenticated?: boolean; roleAllowed?: boolean }) {
    const authenticated = options?.authenticated ?? true
    const roleAllowed = options?.roleAllowed ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CaseHumanReviewController],
      providers: [
        {
          provide: CaseHumanReviewService,
          useValue: mockCaseHumanReviewService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): Record<string, unknown> } }) => {
          if (!authenticated) {
            throw new UnauthorizedException('User not authenticated')
          }

          const req = context.switchToHttp().getRequest()
          req.user = {
            id: '770e8400-e29b-41d4-a716-446655440000',
            role: roleAllowed ? 'admin' : 'respondent',
          }
          return true
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): Record<string, unknown> } }) => {
          const req = context.switchToHttp().getRequest()
          req.tenantId = '660e8400-e29b-41d4-a716-446655440000'
          return true
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => roleAllowed,
      })
      .compile()

    const testApp = moduleFixture.createNestApplication()
    testApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    testApp.useGlobalInterceptors(new TransformInterceptor())
    await testApp.init()

    return testApp
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    app = await createApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('should review a clustered case and write audit log', async () => {
    mockCaseHumanReviewService.reviewCase.mockResolvedValue({
      caseId: 'case-1',
      status: 'reviewed',
      humanReviewed: true,
      reviewedBy: '770e8400-e29b-41d4-a716-446655440000',
      reviewedAt: '2026-03-26T02:00:00.000Z',
      approvedCount: 1,
      rejectedCount: 0,
      manualMappingCount: 0,
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/compliance-cases/case-1/human-review')
      .send({
        approvedMapIds: ['11111111-1111-4111-8111-111111111111'],
      })
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data).toEqual({
      caseId: 'case-1',
      status: 'reviewed',
      humanReviewed: true,
      reviewedBy: '770e8400-e29b-41d4-a716-446655440000',
      reviewedAt: '2026-03-26T02:00:00.000Z',
      approvedCount: 1,
      rejectedCount: 0,
      manualMappingCount: 0,
    })
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        entityType: 'ComplianceCase',
        entityId: 'case-1',
      }),
    )
  })

  it('should reject invalid human review payloads with 400 before service execution', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/compliance-cases/case-1/human-review')
      .send({
        approvedMapIds: ['not-a-uuid'],
      })
      .expect(400)

    expect(mockCaseHumanReviewService.reviewCase).not.toHaveBeenCalled()
  })

  it('should return 401 for unauthenticated requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/compliance-cases/case-1/human-review')
      .send({
        approvedMapIds: ['11111111-1111-4111-8111-111111111111'],
      })
      .expect(401)
  })

  it('should return 403 for authenticated users without required roles', async () => {
    await app.close()
    app = await createApp({ authenticated: true, roleAllowed: false })

    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/compliance-cases/case-1/human-review')
      .send({
        approvedMapIds: ['11111111-1111-4111-8111-111111111111'],
      })
      .expect(403)
  })
})
