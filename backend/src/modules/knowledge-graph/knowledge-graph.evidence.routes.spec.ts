import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { EvidenceController } from './controllers/evidence.controller'
import { EvidenceService } from './services/evidence.service'

describe('KnowledgeGraph evidence controllers (http)', () => {
  let app: INestApplication

  const mockEvidenceService = {
    findAllEvidenceTypes: jest.fn(),
    createEvidenceType: jest.fn(),
    updateEvidenceType: jest.fn(),
    findAllControlEvidenceMaps: jest.fn(),
    createControlEvidenceMap: jest.fn(),
    updateControlEvidenceMap: jest.fn(),
    findEvidencesByControlId: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(options?: { authenticated?: boolean; roleAllowed?: boolean }) {
    const authenticated = options?.authenticated ?? true
    const roleAllowed = options?.roleAllowed ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EvidenceController],
      providers: [
        {
          provide: EvidenceService,
          useValue: mockEvidenceService,
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

  it('should create evidence type and write audit log', async () => {
    mockEvidenceService.createEvidenceType.mockResolvedValue({
      evidenceId: '99999999-9999-4999-8999-999999999999',
      evidenceCode: 'EVD-001',
      evidenceName: '审批记录',
      evidenceCategory: 'approval',
      status: 'ACTIVE',
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/evidence-types')
      .send({
        evidenceCode: 'EVD-001',
        evidenceName: '审批记录',
        evidenceCategory: 'approval',
        status: 'ACTIVE',
      })
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entityType: 'EvidenceType',
        entityId: '99999999-9999-4999-8999-999999999999',
      }),
    )
  })

  it('should reject invalid evidence map payloads with 400 before service execution', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/control-evidence-maps')
      .send({
        controlId: 'not-a-uuid',
        evidenceId: '22222222-2222-4222-8222-222222222222',
        requiredLevel: 'BROKEN',
      })
      .expect(400)

    expect(mockEvidenceService.createControlEvidenceMap).not.toHaveBeenCalled()
    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })

  it('should return structured evidences for a control point', async () => {
    mockEvidenceService.findEvidencesByControlId.mockResolvedValue({
      controlId: '22222222-2222-4222-8222-222222222222',
      evidences: [
        {
          id: 'map-1',
          evidenceId: 'evd-1',
          evidenceCode: 'EVD-001',
          evidenceName: '审批记录',
          evidenceCategory: 'approval',
          requiredLevel: 'REQUIRED',
          evidenceDesc: '关键审批留痕',
        },
      ],
    })

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/control-points/22222222-2222-4222-8222-222222222222/evidences')
      .expect(200)

    expect(response.body).toEqual({
      success: true,
      data: {
        controlId: '22222222-2222-4222-8222-222222222222',
        evidences: [
          {
            id: 'map-1',
            evidenceId: 'evd-1',
            evidenceCode: 'EVD-001',
            evidenceName: '审批记录',
            evidenceCategory: 'approval',
            requiredLevel: 'REQUIRED',
            evidenceDesc: '关键审批留痕',
          },
        ],
      },
    })
  })

  it('should return 401 for unauthenticated requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/evidence-types')
      .expect(401)
  })

  it('should return 403 for authenticated users without required roles', async () => {
    await app.close()
    app = await createApp({ authenticated: true, roleAllowed: false })

    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/evidence-types')
      .send({
        evidenceCode: 'EVD-001',
        evidenceName: '审批记录',
        evidenceCategory: 'approval',
      })
      .expect(403)
  })
})
