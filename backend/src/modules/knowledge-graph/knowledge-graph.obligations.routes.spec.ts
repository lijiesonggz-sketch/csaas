/**
 * ATDD Acceptance Tests — Story 3-2: ObligationController 路由测试
 */

import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'

const loadController = async () => {
  const mod = await import('./controllers/obligation.controller')
  return mod.ObligationController
}

const loadService = async () => {
  const mod = await import('./services/obligation.service')
  return mod.ObligationService
}

const mockObligationService = {
  findAll: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
  findById: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue(null),
  findByClauseId: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
  findControlPointsByObligation: jest
    .fn()
    .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
  createControlMap: jest.fn().mockResolvedValue(null),
  deleteControlMap: jest.fn().mockResolvedValue({ success: true, id: 'map-1' }),
  getCoverageAnalysis: jest.fn().mockResolvedValue({}),
}

const mockAuditLogService = {
  log: jest.fn().mockResolvedValue(undefined),
}

async function createApp(options?: { authenticated?: boolean; roleAllowed?: boolean }) {
  const authenticated = options?.authenticated ?? true
  const roleAllowed = options?.roleAllowed ?? true
  const ObligationControllerClass = await loadController()
  const ObligationServiceClass = await loadService()

  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [ObligationControllerClass],
    providers: [
      { provide: ObligationServiceClass, useValue: mockObligationService },
      { provide: AuditLogService, useValue: mockAuditLogService },
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

describe('KnowledgeGraph obligations controllers (http)', () => {
  let app: INestApplication

  beforeEach(async () => {
    jest.clearAllMocks()
    app = await createApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('should return obligation list with filters', async () => {
    mockObligationService.findAll.mockResolvedValue({
      items: [{ obligationId: 'obl-1', obligationCode: 'OBL-001' }],
      total: 1,
      page: 1,
      limit: 20,
    })

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/obligations')
      .query({ obligationType: 'MANDATORY', status: 'ACTIVE', applicableSector: '银行' })
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(mockObligationService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        obligationType: 'MANDATORY',
        status: 'ACTIVE',
        applicableSector: '银行',
      }),
    )
  })

  it('should resolve coverage-analysis route before :id route', async () => {
    mockObligationService.getCoverageAnalysis.mockResolvedValue({
      totals: { obligations: 2, covered: 1, uncovered: 1, coverageRate: 0.5 },
      originDistribution: {
        case_derived: 0,
        regulation_derived: 1,
        both: 0,
        candidate: 0,
        manual: 1,
      },
      sectorCoverage: [
        { sector: '银行', obligations: 2, covered: 1, coverageRate: 0.5 },
      ],
      blindSpots: [
        {
          obligationId: 'obl-2',
          obligationCode: 'OBL-002',
          obligationText: '不得绕过质量校验',
          obligationType: 'PROHIBITIVE',
          applicableSector: ['证券'],
          clause: {
            clauseId: 'clause-2',
            clauseCode: 'CLAUSE-002',
            articleNo: '第2条',
            clauseSummary: '禁止绕过质量校验',
          },
          source: {
            sourceId: 'source-2',
            sourceCode: 'SRC-002',
            sourceName: '补充规定',
          },
        },
      ],
    })

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/obligations/coverage-analysis')
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(mockObligationService.getCoverageAnalysis).toHaveBeenCalled()
    expect(mockObligationService.findById).not.toHaveBeenCalled()
    expect(response.body.data.blindSpots[0]).toEqual(
      expect.objectContaining({
        obligationCode: 'OBL-002',
        source: expect.objectContaining({
          sourceCode: 'SRC-002',
        }),
      }),
    )
  })

  it('should return error when getCoverageAnalysis service throws', async () => {
    mockObligationService.getCoverageAnalysis.mockRejectedValue(new Error('DB connection lost'))

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/obligations/coverage-analysis')

    expect([500, 400]).toContain(response.status)
  })

  it('should resolve by-clause route before :id route', async () => {
    mockObligationService.findByClauseId.mockResolvedValue({
      items: [{ obligationId: 'obl-1', obligationCode: 'OBL-001' }],
      total: 1,
      page: 1,
      limit: 20,
    })

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/obligations/by-clause/550e8400-e29b-41d4-a716-446655440000')
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(mockObligationService.findByClauseId).toHaveBeenCalled()
    expect(mockObligationService.findById).not.toHaveBeenCalled()
  })

  it('should return obligation detail', async () => {
    mockObligationService.findById.mockResolvedValue({
      obligationId: 'obl-1',
      obligationCode: 'OBL-001',
      clause: { clauseId: 'clause-1', clauseCode: 'CLAUSE-001' },
      controlMaps: [],
    })

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/obligations/550e8400-e29b-41d4-a716-446655440000')
      .expect(200)

    expect(response.body.success).toBe(true)
  })

  it('should create obligation and write audit log', async () => {
    mockObligationService.create.mockResolvedValue({
      obligationId: 'obl-1',
      obligationCode: 'OBL-001',
      status: 'ACTIVE',
      clauseId: 'clause-1',
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/obligations')
      .send({
        clauseId: '550e8400-e29b-41d4-a716-446655440000',
        obligationCode: 'OBL-001',
        obligationText: '应当建立复核机制',
        obligationType: 'MANDATORY',
      })
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entityType: 'RegulationObligation',
      }),
    )
  })

  it('should update obligation and write audit log', async () => {
    mockObligationService.update.mockResolvedValue({
      obligationId: 'obl-1',
      obligationCode: 'OBL-001',
      status: 'ACTIVE',
      clauseId: 'clause-1',
    })

    const response = await request(app.getHttpServer())
      .patch('/api/admin/knowledge-graph/obligations/550e8400-e29b-41d4-a716-446655440000')
      .send({ obligationText: '更新后的义务描述' })
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        entityType: 'RegulationObligation',
      }),
    )
  })

  it('should return mapped control points for an obligation', async () => {
    mockObligationService.findControlPointsByObligation.mockResolvedValue({
      items: [{ controlId: 'control-1', coverage: 'FULL' }],
      total: 1,
      page: 1,
      limit: 20,
    })

    const response = await request(app.getHttpServer())
      .get(
        '/api/admin/knowledge-graph/obligations/550e8400-e29b-41d4-a716-446655440000/control-points',
      )
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data.items[0].coverage).toBe('FULL')
  })

  it('should create an obligation control map and write audit log', async () => {
    mockObligationService.createControlMap.mockResolvedValue({
      id: 'map-1',
      obligationId: 'obl-1',
      controlId: 'control-1',
      coverage: 'FULL',
    })

    const response = await request(app.getHttpServer())
      .post(
        '/api/admin/knowledge-graph/obligations/550e8400-e29b-41d4-a716-446655440000/control-maps',
      )
      .send({
        controlId: '660e8400-e29b-41d4-a716-446655440000',
        coverage: 'FULL',
      })
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(mockObligationService.createControlMap).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({
        controlId: '660e8400-e29b-41d4-a716-446655440000',
        coverage: 'FULL',
      }),
    )
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entityType: 'ObligationControlMap',
      }),
    )
  })

  it('should delete an obligation control map and write audit log', async () => {
    const response = await request(app.getHttpServer())
      .delete(
        '/api/admin/knowledge-graph/obligations/550e8400-e29b-41d4-a716-446655440000/control-maps/660e8400-e29b-41d4-a716-446655440000',
      )
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(mockObligationService.deleteControlMap).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      '660e8400-e29b-41d4-a716-446655440000',
    )
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DELETE,
        entityType: 'ObligationControlMap',
      }),
    )
  })

  it('should reject invalid create payload with 400 before service execution', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/obligations')
      .send({ obligationType: 'INVALID' })
      .expect(400)

    expect(mockObligationService.create).not.toHaveBeenCalled()
  })

  it('should return 401 for unauthenticated requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer()).get('/api/admin/knowledge-graph/obligations').expect(401)
  })

  it('should return 403 for POST without required role', async () => {
    await app.close()
    app = await createApp({ authenticated: true, roleAllowed: false })

    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/obligations')
      .send({
        clauseId: '550e8400-e29b-41d4-a716-446655440000',
        obligationCode: 'OBL-001',
        obligationText: '应当建立复核机制',
        obligationType: 'MANDATORY',
      })
      .expect(403)
  })

  it('should return 403 for control-map mutation endpoints without required role', async () => {
    await app.close()
    app = await createApp({ authenticated: true, roleAllowed: false })

    await request(app.getHttpServer())
      .post(
        '/api/admin/knowledge-graph/obligations/550e8400-e29b-41d4-a716-446655440000/control-maps',
      )
      .send({
        controlId: '660e8400-e29b-41d4-a716-446655440000',
        coverage: 'FULL',
      })
      .expect(403)

    await request(app.getHttpServer())
      .delete(
        '/api/admin/knowledge-graph/obligations/550e8400-e29b-41d4-a716-446655440000/control-maps/660e8400-e29b-41d4-a716-446655440000',
      )
      .expect(403)
  })
})
