import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { OrganizationGuard } from '../organizations/guards/organization.guard'
import { ControlExplainController } from './controllers/control-explain.controller'
import { ControlExplainService } from './services/control-explain.service'

describe('ControlExplainController (http)', () => {
  let app: INestApplication

  const mockControlExplainService = {
    getControlExplain: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(options?: { authenticated?: boolean; organizationAllowed?: boolean }) {
    const authenticated = options?.authenticated ?? true
    const organizationAllowed = options?.organizationAllowed ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ControlExplainController],
      providers: [
        {
          provide: ControlExplainService,
          useValue: mockControlExplainService,
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

  it('should return control explain payload and write audit log', async () => {
    mockControlExplainService.getControlExplain.mockResolvedValue({
      control: {
        controlCode: 'CTRL-DG-004',
      },
      applicabilityReason: '机构属于银行业；监管关注度较高',
      clauses: [],
      cases: [],
      evidences: [],
      questions: [],
      remediations: [],
    })

    const response = await request(app.getHttpServer())
      .get('/compliance-intelligence/control-explain/control-id')
      .query({
        organizationId: '33333333-3333-4333-8333-333333333333',
      })
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.READ,
        entityType: 'ControlExplain',
        entityId: 'control-id',
      }),
    )
  })

  it('should reject invalid query payloads with 400 before service execution', async () => {
    await request(app.getHttpServer())
      .get('/compliance-intelligence/control-explain/control-id')
      .query({
        organizationId: 'not-a-uuid',
      })
      .expect(400)

    expect(mockControlExplainService.getControlExplain).not.toHaveBeenCalled()
    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })

  it('should return 401 for unauthenticated requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer())
      .get('/compliance-intelligence/control-explain/control-id')
      .query({
        organizationId: '33333333-3333-4333-8333-333333333333',
      })
      .expect(401)
  })

  it('should return 403 for cross-organization access', async () => {
    await app.close()
    app = await createApp({ authenticated: true, organizationAllowed: false })

    await request(app.getHttpServer())
      .get('/compliance-intelligence/control-explain/control-id')
      .query({
        organizationId: '33333333-3333-4333-8333-333333333333',
      })
      .expect(403)
  })
})
