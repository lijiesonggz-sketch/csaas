import {
  INestApplication,
  NotFoundException,
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
import { ControlReportController } from './controllers/control-report.controller'
import { ControlReportCompilerService } from './services/control-report-compiler.service'

describe('ControlReportController (http)', () => {
  let app: INestApplication

  const mockControlReportCompilerService = {
    compileReport: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(options?: { authenticated?: boolean; organizationAllowed?: boolean }) {
    const authenticated = options?.authenticated ?? true
    const organizationAllowed = options?.organizationAllowed ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ControlReportController],
      providers: [
        {
          provide: ControlReportCompilerService,
          useValue: mockControlReportCompilerService,
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
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): Record<string, unknown> } }) => {
          const req = context.switchToHttp().getRequest()
          req.tenantId = '660e8400-e29b-41d4-a716-446655440000'
          return true
        },
      })
      .overrideGuard(OrganizationGuard)
      .useValue({
        canActivate: () => organizationAllowed,
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

  it('should return the compiled report sections payload and write audit log', async () => {
    mockControlReportCompilerService.compileReport.mockResolvedValue({
      sections: [
        {
          l1Code: 'IT04',
          l1Name: '数据治理与监管数据报送',
          l2Sections: [
            {
              l2Code: 'IT04-06',
              l2Name: '监管报送准确性控制',
              controls: [
                {
                  controlId: 'control-1',
                  controlCode: 'CTRL-DG-004',
                  controlName: '监管报送准确性控制',
                  currentStatus: 'PARTIAL',
                  gapLevel: 'MEDIUM',
                  clauses: [],
                  cases: [],
                  evidences: [],
                  recommendations: [
                    {
                      controlId: 'control-1',
                      remediationActionId: 'action-1',
                      actionCode: 'RA-CTRL-001',
                      actionTitle: '复核监管报送校验流程',
                      actionDesc: '核对监管报送校验规则与人工复核记录',
                      priority: 'HIGH',
                      currentStatus: 'PARTIAL',
                      gapLevel: 'MEDIUM',
                      expectedBenefit: '提升监管报送准确性',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })

    const response = await request(app.getHttpServer())
      .post('/compliance-intelligence/compile-control-report')
      .send({
        organizationId: '33333333-3333-4333-8333-333333333333',
        controlIds: ['11111111-1111-4111-8111-111111111111'],
        surveyResponseId: '55555555-5555-4555-8555-555555555555',
      })
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(response.body.data).toMatchObject({
      sections: [
        expect.objectContaining({
          l1Code: 'IT04',
        }),
      ],
    })
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.READ,
        entityType: 'ControlReport',
        entityId: '55555555-5555-4555-8555-555555555555',
        details: expect.objectContaining({
          requestedControlCount: 1,
          compiledControlCount: 1,
          sectionCount: 1,
          recommendationCount: 1,
        }),
      }),
    )
  })

  it('should reject invalid request payloads with 400 before service execution', async () => {
    await request(app.getHttpServer())
      .post('/compliance-intelligence/compile-control-report')
      .send({
        organizationId: 'not-a-uuid',
        controlIds: [],
        surveyResponseId: '55555555-5555-4555-8555-555555555555',
      })
      .expect(400)

    expect(mockControlReportCompilerService.compileReport).not.toHaveBeenCalled()
    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })

  it('should return 404 when survey response or control scope is invalid', async () => {
    mockControlReportCompilerService.compileReport.mockRejectedValue(
      new NotFoundException('Controls not applicable to organization'),
    )

    await request(app.getHttpServer())
      .post('/compliance-intelligence/compile-control-report')
      .send({
        organizationId: '33333333-3333-4333-8333-333333333333',
        controlIds: ['11111111-1111-4111-8111-111111111111'],
        surveyResponseId: '55555555-5555-4555-8555-555555555555',
      })
      .expect(404)
  })

  it('should return 401 for unauthenticated requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer())
      .post('/compliance-intelligence/compile-control-report')
      .send({
        organizationId: '33333333-3333-4333-8333-333333333333',
        controlIds: ['11111111-1111-4111-8111-111111111111'],
        surveyResponseId: '55555555-5555-4555-8555-555555555555',
      })
      .expect(401)
  })

  it('should return 403 for cross-organization access', async () => {
    await app.close()
    app = await createApp({ authenticated: true, organizationAllowed: false })

    await request(app.getHttpServer())
      .post('/compliance-intelligence/compile-control-report')
      .send({
        organizationId: '33333333-3333-4333-8333-333333333333',
        controlIds: ['11111111-1111-4111-8111-111111111111'],
        surveyResponseId: '55555555-5555-4555-8555-555555555555',
      })
      .expect(403)
  })

  describe('Unified Control Context Protocol (Story 7.1)', () => {
    it('should include control context fields in each control node', async () => {
      // Mock service 返回 enriched响应
      const reportId = 'report-123'
      mockControlReportCompilerService.compileReport.mockResolvedValue({
        sections: [
          {
            l1Code: 'IT04',
            l1Name: '数据治理与监管数据报送',
            l2Sections: [
              {
                l2Code: 'IT04-06',
                l2Name: '监管报送准确性控制',
                controls: [
                  {
                    controlId: 'control-1',
                    controlCode: 'CTRL-DG-004',
                    controlName: '监管报送准确性控制',
                    currentStatus: 'PARTIAL',
                    gapLevel: 'MEDIUM',
                    clauses: [],
                    cases: [],
                    evidences: [],
                    recommendations: [],
                    // Story 7.1 新增的 Unified Control Context 字段
                    matchedControls: [
                      {
                        controlId: 'control-1',
                        controlName: '监管报送准确性控制',
                        packSource: 'report',
                        priority: 'MEDIUM',
                      },
                    ],
                    sourceModule: 'report',
                    sourceRecordId: reportId,
                    sourceRoute: `/reports/${reportId}`,
                  },
                ],
              },
            },
          ],
        ],
      })

      const response = await request(app.getHttpServer())
        .post('/compliance-intelligence/compile-control-report')
        .send({
          organizationId: '33333333-3333-4333-8333-333333333333',
          controlIds: ['11111111-1111-4111-8111-111111111111'],
          surveyResponseId: '55555555-5555-4555-8555-555555555555',
        })
        .expect(201)

      // 验证 Unified Control Context Protocol 字段
      const controlNode = response.body.data.sections[0].l2Sections[0].controls[0]
      expect(controlNode).toHaveProperty('sourceModule', 'report')
      expect(controlNode).toHaveProperty('sourceRecordId', reportId)
      expect(controlNode).toHaveProperty('sourceRoute')
      expect(controlNode).toHaveProperty('controlId', 'control-1')
      expect(controlNode).toHaveProperty('matchedControls')
      expect(controlNode.matchedControls).toHaveLength(1)
    })

    it('should maintain controlId consistency with node data', async () => {
      // 验证 controlId 与节点数据一致
      const reportId = 'report-456'
      mockControlReportCompilerService.compileReport.mockResolvedValue({
        sections: [
          {
            l1Code: 'IT04',
            l1Name: '数据治理与监管数据报送',
            l2Sections: [
              {
                l2Code: 'IT04-06',
                l2Name: '监管报送准确性控制',
                controls: [
                  {
                    controlId: 'control-2',
                    controlCode: 'CTRL-DG-005',
                    controlName: '个人信息保护控制',
                    currentStatus: 'INCOMPLETE',
                    gapLevel: 'HIGH',
                    clauses: [],
                    cases: [],
                    evidences: [],
                    recommendations: [],
                    // Story 7.1 字段
                    matchedControls: [
                      {
                        controlId: 'control-2',
                        controlName: '个人信息保护控制',
                        packSource: 'report',
                        priority: 'HIGH',
                      },
                    ],
                    sourceModule: 'report',
                    sourceRecordId: reportId,
                    sourceRoute: `/reports/${reportId}`,
                  },
                ],
              },
            },
          ],
        ],
      })

      const response = await request(app.getHttpServer())
        .post('/compliance-intelligence/compile-control-report')
        .send({
          organizationId: '33333333-3333-4333-8333-333333333333',
          controlIds: ['11111111-1111-4111-8111-111111111111'],
          surveyResponseId: '55555555-5555-4555-8555-555555555555',
        })
        .expect(201)

      const controlNode = response.body.data.sections[0].l2Sections[0].controls[0]
      expect(controlNode.controlId).toBe('control-2')
      expect(controlNode.matchedControls[0].controlId).toBe('control-2')
    })

    it('should handle empty control gracefully', async () => {
      // 空控制点场景
      const reportId = 'report-empty'
      mockControlReportCompilerService.compileReport.mockResolvedValue({
        sections: [
          {
            l1Code: 'IT99',
            l1Name: '空风险域',
            l2Sections: [],
          },
        ],
      })

      const response = await request(app.getHttpServer())
        .post('/compliance-intelligence/compile-control-report')
        .send({
          organizationId: '33333333-3333-4333-8333-333333333333',
          controlIds: [],
          surveyResponseId: '55555555-5555-4555-8555-555555555555',
        })
        .expect(201)

      // 空 sections 是合法的
      expect(response.body.data.sections).toBeDefined()
    })
  })
})
