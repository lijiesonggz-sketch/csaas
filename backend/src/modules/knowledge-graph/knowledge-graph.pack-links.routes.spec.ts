import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { ControlPackLinkController } from './controllers/control-pack-link.controller'
import { ControlPackLinkService } from './services/control-pack-link.service'

describe('KnowledgeGraph pack link controllers (http)', () => {
  let app: INestApplication

  const mockControlPackLinkService = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findPackLinksByControlId: jest.fn(),
    buildApplicabilityContext: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(options?: { authenticated?: boolean; roleAllowed?: boolean }) {
    const authenticated = options?.authenticated ?? true
    const roleAllowed = options?.roleAllowed ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ControlPackLinkController],
      providers: [
        {
          provide: ControlPackLinkService,
          useValue: mockControlPackLinkService,
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

  it('should create control-pack-item and write audit log', async () => {
    mockControlPackLinkService.create.mockResolvedValue({
      id: '99999999-9999-4999-8999-999999999999',
      packId: '11111111-1111-4111-8111-111111111111',
      controlId: '22222222-2222-4222-8222-222222222222',
      itemRole: 'INCLUDE',
      priority: 10,
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/control-pack-items')
      .send({
        packId: '11111111-1111-4111-8111-111111111111',
        controlId: '22222222-2222-4222-8222-222222222222',
        itemRole: 'INCLUDE',
        priority: 10,
      })
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entityType: 'ControlPackItem',
        entityId: '99999999-9999-4999-8999-999999999999',
      }),
    )
  })

  it('should reject invalid payloads with 400 before service execution', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/control-pack-items')
      .send({
        packId: 'not-a-uuid',
        controlId: '22222222-2222-4222-8222-222222222222',
        itemRole: 'BROKEN',
      })
      .expect(400)

    expect(mockControlPackLinkService.create).not.toHaveBeenCalled()
    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })

  it('should return static pack links for a control point', async () => {
    mockControlPackLinkService.findPackLinksByControlId.mockResolvedValue({
      controlId: '22222222-2222-4222-8222-222222222222',
      items: [
        {
          id: 'map-1',
          packCode: 'PACK-BASE-CYBER',
          packType: 'base',
        },
      ],
    })

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/control-points/22222222-2222-4222-8222-222222222222/pack-links')
      .expect(200)

    expect(response.body).toEqual({
      success: true,
      data: {
        controlId: '22222222-2222-4222-8222-222222222222',
        items: [
          {
            id: 'map-1',
            packCode: 'PACK-BASE-CYBER',
            packType: 'base',
          },
        ],
      },
    })
  })

  it('should return explain-ready applicability context for a control point', async () => {
    mockControlPackLinkService.buildApplicabilityContext.mockResolvedValue({
      controlId: '22222222-2222-4222-8222-222222222222',
      organizationId: '33333333-3333-4333-8333-333333333333',
      matched: true,
      matchedPacks: [
        {
          packCode: 'PACK-BASE-CYBER',
          packType: 'base',
        },
      ],
      matchedRules: ['RULE-PACK-BASE-CYBER-INCLUDE-001'],
      priority: 'HIGH',
      mandatory: true,
      reasons: ['所有金融机构均应满足网络安全控制要求'],
      questionPackCodes: ['QPACK-ACC-BASE'],
      evidencePackCodes: ['EPACK-ACC-BASE'],
      remediationPackCodes: ['RPACK-ACC-BASE'],
      linkedPacks: [],
    })

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/control-points/22222222-2222-4222-8222-222222222222/applicability-context')
      .query({
        organizationId: '33333333-3333-4333-8333-333333333333',
      })
      .expect(200)

    expect(response.body).toEqual({
      success: true,
      data: {
        controlId: '22222222-2222-4222-8222-222222222222',
        organizationId: '33333333-3333-4333-8333-333333333333',
        matched: true,
        matchedPacks: [
          {
            packCode: 'PACK-BASE-CYBER',
            packType: 'base',
          },
        ],
        matchedRules: ['RULE-PACK-BASE-CYBER-INCLUDE-001'],
        priority: 'HIGH',
        mandatory: true,
        reasons: ['所有金融机构均应满足网络安全控制要求'],
        questionPackCodes: ['QPACK-ACC-BASE'],
        evidencePackCodes: ['EPACK-ACC-BASE'],
        remediationPackCodes: ['RPACK-ACC-BASE'],
        linkedPacks: [],
      },
    })
  })

  it('should return 401 for unauthenticated requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/control-pack-items')
      .expect(401)
  })

  it('should return 403 for authenticated users without required roles', async () => {
    await app.close()
    app = await createApp({ authenticated: true, roleAllowed: false })

    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/control-pack-items')
      .send({
        packId: '11111111-1111-4111-8111-111111111111',
        controlId: '22222222-2222-4222-8222-222222222222',
        itemRole: 'INCLUDE',
        priority: 10,
      })
      .expect(403)
  })
})
