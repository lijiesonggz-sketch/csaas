import {
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { AITaskType } from '../../database/entities/ai-task.entity'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ProjectReviewController } from './controllers/project-review.controller'
import { AuditLogService } from './services/audit-log.service'
import { ProjectReviewService } from './services/project-review.service'

describe('ProjectReviewController (http)', () => {
  let app: INestApplication

  const mockProjectReviewService = {
    assertAccess: jest.fn(),
    getReviewItems: jest.fn(),
    bulkApprove: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(options?: { authenticated?: boolean }) {
    const authenticated = options?.authenticated ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProjectReviewController],
      providers: [
        {
          provide: ProjectReviewService,
          useValue: mockProjectReviewService,
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
            role: 'consultant',
          }
          return true
        },
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

  it('should return aggregated review items and write read audit log', async () => {
    mockProjectReviewService.assertAccess.mockResolvedValue({
      id: 'project-1',
      organizationId: 'org-1',
    })
    mockProjectReviewService.getReviewItems.mockResolvedValue({
      items: [
        {
          reviewItemId: 'review-1',
          sourceResultId: 'review-1',
          taskId: 'task-1',
          taskType: AITaskType.SUMMARY,
          reviewStage: AITaskType.SUMMARY,
          title: '综述生成',
          reviewStatus: 'pending',
          confidenceLevel: 'medium',
          consistencyScores: {
            structural: 0.8,
            semantic: 0.75,
            detail: null,
          },
          highRiskFlag: false,
          canRerun: true,
          controlId: null,
          matchedControls: [],
          sourceModule: 'audit',
          sourceRecordId: 'review-1',
          sourceRoute: '/projects/project-1/review',
          riskLevel: 'medium',
          degradationReasons: [],
          sourcePreview: {
            aiExcerpt: 'AI excerpt',
            sourceExcerpt: 'preview excerpt',
            sourceDocumentName: 'preview.docx',
            extractionQuality: 'partial',
          },
          provenanceStatus: 'degraded_preview',
          citationChain: null,
          createdAt: '2026-03-30T10:00:00.000Z',
          updatedAt: '2026-03-30T10:10:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      filtersApplied: {
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
    })

    const response = await request(app.getHttpServer())
      .get('/projects/project-1/review-items')
      .query({
        page: 1,
        pageSize: 20,
      })
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data.items[0].provenanceStatus).toBe('degraded_preview')
    expect(response.body.data.items[0].citationChain).toBeNull()
    expect(mockProjectReviewService.assertAccess).toHaveBeenCalledWith(
      'project-1',
      '770e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({
        ipAddress: expect.any(String),
      }),
    )
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.READ,
        entityType: 'ProjectReviewList',
        entityId: 'project-1',
      }),
    )
  })

  it('should reject invalid query payloads with 400 before service execution', async () => {
    await request(app.getHttpServer())
      .get('/projects/project-1/review-items')
      .query({
        page: 0,
        sortBy: 'unknown-field',
      })
      .expect(400)

    expect(mockProjectReviewService.assertAccess).not.toHaveBeenCalled()
    expect(mockProjectReviewService.getReviewItems).not.toHaveBeenCalled()
    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })

  it('should bulk approve a single-stage review batch', async () => {
    mockProjectReviewService.assertAccess.mockResolvedValue({
      id: 'project-1',
      organizationId: 'org-1',
    })
    mockProjectReviewService.bulkApprove.mockResolvedValue({
      reviewStage: AITaskType.SUMMARY,
      filtersApplied: {
        reviewStage: AITaskType.SUMMARY,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
      blockedReviewItemIds: [],
      approvedReviewItemIds: ['review-1'],
    })

    const response = await request(app.getHttpServer())
      .post('/projects/project-1/review-items/bulk-approve')
      .send({
        reviewStage: AITaskType.SUMMARY,
      })
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(mockProjectReviewService.bulkApprove).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'project-1',
      }),
      '770e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({
        reviewStage: AITaskType.SUMMARY,
      }),
      expect.objectContaining({
        ipAddress: expect.any(String),
      }),
    )
  })

  it('should reject bulk approve payloads without a locked reviewStage', async () => {
    await request(app.getHttpServer())
      .post('/projects/project-1/review-items/bulk-approve')
      .send({})
      .expect(400)

    expect(mockProjectReviewService.assertAccess).not.toHaveBeenCalled()
    expect(mockProjectReviewService.bulkApprove).not.toHaveBeenCalled()
  })

  it('should return 403 when access assertion fails', async () => {
    mockProjectReviewService.assertAccess.mockRejectedValue(
      new ForbiddenException('您没有权限访问该项目的审核工作台'),
    )

    await request(app.getHttpServer()).get('/projects/project-1/review-items').expect(403)

    expect(mockProjectReviewService.getReviewItems).not.toHaveBeenCalled()
  })

  it('should return 401 for unauthenticated requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer()).get('/projects/project-1/review-items').expect(401)
  })
})
