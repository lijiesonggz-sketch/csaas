import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { RemediationActionController } from './controllers/remediation-action.controller'
import { RemediationActionService } from './services/remediation-action.service'

describe('KnowledgeGraph remediation action controllers (http)', () => {
  let app: INestApplication

  const mockRemediationActionService = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findByControlId: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(options?: { authenticated?: boolean; roleAllowed?: boolean }) {
    const authenticated = options?.authenticated ?? true
    const roleAllowed = options?.roleAllowed ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RemediationActionController],
      providers: [
        {
          provide: RemediationActionService,
          useValue: mockRemediationActionService,
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

  it('should create remediation action and write audit log', async () => {
    mockRemediationActionService.create.mockResolvedValue({
      actionId: '99999999-9999-4999-8999-999999999999',
      controlId: '11111111-1111-4111-8111-111111111111',
      actionCode: 'RA-CTRL-001',
      priorityDefault: 'HIGH',
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/remediation-actions')
      .send({
        controlId: '11111111-1111-4111-8111-111111111111',
        actionCode: 'RA-CTRL-001',
        actionTitle: '建立正式制度',
        priorityDefault: 'HIGH',
        status: 'ACTIVE',
      })
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entityType: 'RemediationAction',
        entityId: '99999999-9999-4999-8999-999999999999',
      }),
    )
  })

  it('should reject invalid remediation payloads with 400 before service execution', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/remediation-actions')
      .send({
        controlId: 'not-a-uuid',
        actionCode: 'broken-code',
        actionTitle: '',
        priorityDefault: 'BROKEN',
      })
      .expect(400)

    expect(mockRemediationActionService.create).not.toHaveBeenCalled()
    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })

  it('should return structured remediations for a control point', async () => {
    mockRemediationActionService.findByControlId.mockResolvedValue({
      controlId: '22222222-2222-4222-8222-222222222222',
      remediations: [
        {
          actionId: 'action-1',
          controlId: '22222222-2222-4222-8222-222222222222',
          actionCode: 'RA-CTRL-001',
          actionTitle: '建立正式制度',
          actionDesc: '补齐管理制度并审批发布',
          priorityDefault: 'HIGH',
          status: 'ACTIVE',
        },
      ],
    })

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/control-points/22222222-2222-4222-8222-222222222222/remediations')
      .expect(200)

    expect(response.body).toEqual({
      success: true,
      data: {
        controlId: '22222222-2222-4222-8222-222222222222',
        remediations: [
          {
            actionId: 'action-1',
            controlId: '22222222-2222-4222-8222-222222222222',
            actionCode: 'RA-CTRL-001',
            actionTitle: '建立正式制度',
            actionDesc: '补齐管理制度并审批发布',
            priorityDefault: 'HIGH',
            status: 'ACTIVE',
          },
        ],
      },
    })
  })

  it('should return 401 for unauthenticated requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/remediation-actions')
      .expect(401)
  })

  it('should return 403 for authenticated users without required roles', async () => {
    await app.close()
    app = await createApp({ authenticated: true, roleAllowed: false })

    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/remediation-actions')
      .send({
        controlId: '11111111-1111-4111-8111-111111111111',
        actionCode: 'RA-CTRL-001',
        actionTitle: '建立正式制度',
      })
      .expect(403)
  })
})
