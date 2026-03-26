import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { OrganizationGuard } from '../organizations/guards/organization.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { RadarRelevanceController } from './controllers/radar-relevance.controller'
import { RadarRelevanceEnhancedService } from './services/radar-relevance-enhanced.service'

describe('RadarRelevanceController (http)', () => {
  let app: INestApplication

  const mockRadarRelevanceEnhancedService = {
    calculateRadarRelevance: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(options?: { authenticated?: boolean; organizationAllowed?: boolean }) {
    const authenticated = options?.authenticated ?? true
    const organizationAllowed = options?.organizationAllowed ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RadarRelevanceController],
      providers: [
        {
          provide: RadarRelevanceEnhancedService,
          useValue: mockRadarRelevanceEnhancedService,
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

  it('should return the enhanced radar relevance payload and write audit log', async () => {
    mockRadarRelevanceEnhancedService.calculateRadarRelevance.mockResolvedValue({
      relevanceScore: 0.92,
      priority: 'HIGH',
      matchedControls: [
        {
          controlId: 'control-1',
          controlCode: 'CTRL-DG-004',
          controlName: '监管报送准确性控制',
          reason: '命中控制语义：监管报送',
        },
      ],
      matchedCases: [],
      matchedClauses: [],
      suggestedChecks: [
        {
          controlId: 'control-1',
          controlCode: 'CTRL-DG-004',
          checkType: 'QUESTION',
          sourceId: 'question-1',
          sourceCode: 'Q-CTRL-001',
          title: '是否校验监管报送准确性？',
          detail: '问题类型：single_choice；差距等级：HIGH',
          priority: 'HIGH',
        },
      ],
    })

    const response = await request(app.getHttpServer())
      .post('/compliance-intelligence/radar/relevance')
      .send({
        organizationId: '33333333-3333-4333-8333-333333333333',
        contentId: '44444444-4444-4444-8444-444444444444',
        surveyResponseId: '55555555-5555-4555-8555-555555555555',
      })
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(response.body.data).toMatchObject({
      relevanceScore: 0.92,
      priority: 'HIGH',
      suggestedChecks: [
        expect.objectContaining({
          controlId: 'control-1',
          checkType: 'QUESTION',
          sourceCode: 'Q-CTRL-001',
        }),
      ],
    })
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.READ,
        entityType: 'RadarRelevance',
        entityId: '44444444-4444-4444-8444-444444444444',
        details: expect.objectContaining({
          organizationId: '33333333-3333-4333-8333-333333333333',
          contentId: '44444444-4444-4444-8444-444444444444',
          matchedControlCount: 1,
          suggestedCheckCount: 1,
          priority: 'HIGH',
        }),
      }),
    )
  })

  it('should reject invalid request payloads with 400 before service execution', async () => {
    await request(app.getHttpServer())
      .post('/compliance-intelligence/radar/relevance')
      .send({
        organizationId: 'not-a-uuid',
        contentId: '44444444-4444-4444-8444-444444444444',
      })
      .expect(400)

    expect(mockRadarRelevanceEnhancedService.calculateRadarRelevance).not.toHaveBeenCalled()
    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })

  it('should return 401 for unauthenticated requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer())
      .post('/compliance-intelligence/radar/relevance')
      .send({
        organizationId: '33333333-3333-4333-8333-333333333333',
        contentId: '44444444-4444-4444-8444-444444444444',
      })
      .expect(401)
  })

  it('should return 403 for cross-organization access', async () => {
    await app.close()
    app = await createApp({ authenticated: true, organizationAllowed: false })

    await request(app.getHttpServer())
      .post('/compliance-intelligence/radar/relevance')
      .send({
        organizationId: '33333333-3333-4333-8333-333333333333',
        contentId: '44444444-4444-4444-8444-444444444444',
      })
      .expect(403)
  })
})
