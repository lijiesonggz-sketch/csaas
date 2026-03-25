import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { ControlPointController } from './controllers/control-point.controller'
import { TaxonomyController } from './controllers/taxonomy.controller'
import { ControlPointService } from './services/control-point.service'
import { TaxonomyService } from './services/taxonomy.service'

describe('KnowledgeGraph controllers (http)', () => {
  let app: INestApplication

  const mockTaxonomyService = {
    getTree: jest.fn(),
    createL1: jest.fn(),
    updateL1: jest.fn(),
    createL2: jest.fn(),
    updateL2: jest.fn(),
  }

  const mockControlPointService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(options?: { authenticated?: boolean; roleAllowed?: boolean }) {
    const authenticated = options?.authenticated ?? true
    const roleAllowed = options?.roleAllowed ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TaxonomyController, ControlPointController],
      providers: [
        {
          provide: TaxonomyService,
          useValue: mockTaxonomyService,
        },
        {
          provide: ControlPointService,
          useValue: mockControlPointService,
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

  it('should create taxonomy l1 and write audit log', async () => {
    mockTaxonomyService.createL1.mockResolvedValue({
      l1Code: 'IT01',
      l1Name: '信息科技治理与风险管理',
      sortOrder: 10,
      status: 'ACTIVE',
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy/l1')
      .send({
        l1Code: 'IT01',
        l1Name: '信息科技治理与风险管理',
        sortOrder: 10,
        status: 'ACTIVE',
      })
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entityType: 'TaxonomyL1',
        entityId: 'IT01',
      }),
    )
  })

  it('should reject invalid payloads with 400 before service execution', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/control-points')
      .send({
        controlCode: 'CTRL-ACC-021',
        controlName: 'Privileged Session Review Control',
        l1Code: 'IT02',
        l2Code: 'wrong-code',
        controlFamily: 'ACC_PRIVILEGED',
        controlType: 'detective',
        mandatoryDefault: true,
        riskLevelDefault: 'HIGH',
      })
      .expect(400)

    expect(mockControlPointService.create).not.toHaveBeenCalled()
  })

  it('should reject null controlType on update before service execution', async () => {
    await request(app.getHttpServer())
      .put('/api/admin/knowledge-graph/control-points/99999999-9999-4999-8999-999999999999')
      .send({
        controlType: null,
      })
      .expect(400)

    expect(mockControlPointService.update).not.toHaveBeenCalled()
  })
})
