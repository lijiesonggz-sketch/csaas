import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { OrganizationGuard } from '../organizations/guards/organization.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { ReportCenterController } from './controllers/report-center.controller'
import { ReportCenterService } from './services/report-center.service'

describe('ReportCenterController (http)', () => {
  let app: INestApplication

  const mockReportCenterService = {
    getReportCenter: jest.fn(),
    getReportDetail: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(options?: { authenticated?: boolean }) {
    const authenticated = options?.authenticated ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ReportCenterController],
      providers: [
        {
          provide: ReportCenterService,
          useValue: mockReportCenterService,
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
          }
          return true
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): Record<string, unknown> } }) => {
          const req = context.switchToHttp().getRequest()
          req.tenantId = 'tenant-1'
          return true
        },
      })
      .overrideGuard(OrganizationGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): Record<string, unknown> } }) => {
          const req = context.switchToHttp().getRequest()
          req.orgId = 'org-1'
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

  it('should return report center items and write read audit log', async () => {
    mockReportCenterService.getReportCenter.mockResolvedValue({
      items: [
        {
          projectId: 'project-1',
          projectName: '项目一',
          organizationId: 'org-1',
          reportId: 'survey-1',
          reportStatus: 'ready',
          latestSurveyResponseId: 'survey-1',
          generatedAt: '2026-03-30T08:00:00.000Z',
          updatedAt: '2026-03-30T09:00:00.000Z',
          projectSummary: {
            clientName: '客户A',
            standardName: 'ISO27001',
            projectStatus: 'active',
          },
          gapSummary: {
            overallMaturity: 3.6,
            overallGrade: '充分规范级',
            topShortcomings: [],
          },
          riskSummary: {
            conflictSeverity: 'LOW',
            conflictCount: 0,
            topRiskClusters: [],
          },
          emptyStateReason: null,
          availableActions: {
            viewReport: true,
          },
        },
      ],
      summary: {
        totalItems: 1,
        readyCount: 1,
        notReadyCount: 0,
        failedCount: 0,
      },
      filtersApplied: {
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
    })

    const response = await request(app.getHttpServer())
      .get('/compliance-intelligence/report-center')
      .query({
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data.items[0].reportStatus).toBe('ready')
    expect(mockReportCenterService.getReportCenter).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      }),
    )
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.READ,
        entityType: 'ReportCenter',
        entityId: 'org-1',
      }),
    )
  })

  it('should reject invalid query payloads with 400 before service execution', async () => {
    await request(app.getHttpServer())
      .get('/compliance-intelligence/report-center')
      .query({
        projectId: 'not-a-uuid',
        sortBy: 'unknown',
      })
      .expect(400)

    expect(mockReportCenterService.getReportCenter).not.toHaveBeenCalled()
    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })

  it('should return compiled report detail and write detail audit log', async () => {
    mockReportCenterService.getReportDetail.mockResolvedValue({
      sections: [{ l1Code: 'IT01', l1Name: '身份安全', l2Sections: [] }],
    })

    const response = await request(app.getHttpServer())
      .get('/compliance-intelligence/report-center/11111111-1111-4111-8111-111111111111')
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data.sections).toHaveLength(1)
    expect(mockReportCenterService.getReportDetail).toHaveBeenCalledWith(
      'org-1',
      '11111111-1111-4111-8111-111111111111',
    )
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.READ,
        entityType: 'ReportCenterDetail',
        entityId: '11111111-1111-4111-8111-111111111111',
      }),
    )
  })

  it('should return 401 for unauthenticated requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer()).get('/compliance-intelligence/report-center').expect(401)
  })
})
