import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { ComplianceCaseController } from './controllers/compliance-case.controller'
import { RegulationController } from './controllers/regulation.controller'
import { ComplianceCaseService } from './services/compliance-case.service'
import { ControlPointService } from './services/control-point.service'
import { ObligationService } from './services/obligation.service'
import { RegulationService } from './services/regulation.service'

describe('KnowledgeGraph regulation controllers (http)', () => {
  let app: INestApplication

  const mockRegulationService = {
    findAllSources: jest.fn(),
    createSource: jest.fn(),
    updateSource: jest.fn(),
    findAllClauses: jest.fn(),
    createClause: jest.fn(),
    updateClause: jest.fn(),
    findAllClauseControlMaps: jest.fn(),
    createClauseControlMap: jest.fn(),
    updateClauseControlMap: jest.fn(),
    deleteClauseControlMap: jest.fn(),
    findClausesByControlId: jest.fn(),
  }

  const mockObligationService = {
    findRegulatoryLinksByControlId: jest.fn(),
  }

  const mockComplianceCaseService = {
    findAllCases: jest.fn(),
    createCase: jest.fn(),
    updateCase: jest.fn(),
    getCaseExtractionResult: jest.fn(),
    getCaseClusteringResult: jest.fn(),
    findAllCaseControlMaps: jest.fn(),
    createCaseControlMap: jest.fn(),
    updateCaseControlMap: jest.fn(),
    findCasesByControlId: jest.fn(),
  }

  const mockControlPointService = {
    findOne: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(options?: { authenticated?: boolean; roleAllowed?: boolean }) {
    const authenticated = options?.authenticated ?? true
    const roleAllowed = options?.roleAllowed ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RegulationController, ComplianceCaseController],
      providers: [
        {
          provide: RegulationService,
          useValue: mockRegulationService,
        },
        {
          provide: ObligationService,
          useValue: mockObligationService,
        },
        {
          provide: ComplianceCaseService,
          useValue: mockComplianceCaseService,
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

  it('should create regulation source and write audit log', async () => {
    mockRegulationService.createSource.mockResolvedValue({
      sourceId: '99999999-9999-4999-8999-999999999999',
      sourceCode: 'SRC-001',
      sourceName: '监管指引',
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/regulation-sources')
      .send({
        sourceCode: 'SRC-001',
        sourceName: '监管指引',
        sourceLevel: 'guideline',
        sourceStatus: 'ACTIVE',
      })
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entityType: 'RegulationSource',
        entityId: '99999999-9999-4999-8999-999999999999',
      }),
    )
  })

  it('should reject invalid clause payloads with 400 before service execution', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/regulation-clauses')
      .send({
        sourceId: 'not-a-uuid',
        clauseCode: 'CLAUSE-001',
        clauseText: 'Clause text',
      })
      .expect(400)

    expect(mockRegulationService.createClause).not.toHaveBeenCalled()
    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })

  it('should create compliance case and write audit log', async () => {
    mockComplianceCaseService.createCase.mockResolvedValue({
      caseId: '88888888-8888-4888-8888-888888888888',
      caseCode: 'CASE-001',
      status: 'pending',
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/compliance-cases')
      .send({
        caseCode: 'CASE-001',
        caseTitle: '处罚案例',
        status: 'pending',
      })
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entityType: 'ComplianceCase',
        entityId: '88888888-8888-4888-8888-888888888888',
      }),
    )
  })

  it('should pass batchId query through to compliance case list service', async () => {
    mockComplianceCaseService.findAllCases.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    })

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/compliance-cases')
      .query({
        batchId: 'PBOC-batch-001',
        regulatorCode: 'PBOC',
        status: 'clustered',
        keyword: '客户身份识别',
      })
      .expect(200)

    expect(response.body).toEqual({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      },
    })
    expect(mockComplianceCaseService.findAllCases).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: 'PBOC-batch-001',
        regulatorCode: 'PBOC',
        status: 'clustered',
        keyword: '客户身份识别',
      }),
    )
  })

  it('should return regulatory links with empty cases array when no cases are mapped', async () => {
    mockControlPointService.findOne.mockResolvedValue({
      controlId: '77777777-7777-4777-8777-777777777777',
    })
    mockObligationService.findRegulatoryLinksByControlId.mockResolvedValue({
      obligations: [
        {
          obligationId: 'obl-id',
          obligationCode: 'OBL-001',
          linkSource: 'obligation',
        },
      ],
      clauses: [
        {
          clauseId: 'clause-id',
          clauseCode: 'CLAUSE-001',
          linkSource: 'clause',
        },
      ],
    })
    mockComplianceCaseService.findCasesByControlId.mockResolvedValue([])

    const response = await request(app.getHttpServer())
      .get(
        '/api/admin/knowledge-graph/control-points/77777777-7777-4777-8777-777777777777/regulatory-links',
      )
      .expect(200)

    expect(response.body).toEqual({
      success: true,
      data: {
        controlId: '77777777-7777-4777-8777-777777777777',
        obligations: [
          {
            obligationId: 'obl-id',
            obligationCode: 'OBL-001',
            linkSource: 'obligation',
          },
        ],
        clauses: [
          {
            clauseId: 'clause-id',
            clauseCode: 'CLAUSE-001',
            linkSource: 'clause',
          },
        ],
        cases: [],
      },
    })
  })

  it('should delete a clause-control-map mapping', async () => {
    mockRegulationService.deleteClauseControlMap.mockResolvedValue({
      success: true,
      id: 'map-1',
    })

    const response = await request(app.getHttpServer())
      .delete('/api/admin/knowledge-graph/clause-control-maps/map-1')
      .expect(200)

    expect(response.body).toEqual({
      success: true,
      id: 'map-1',
    })
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DELETE,
        entityType: 'ClauseControlMap',
        entityId: 'map-1',
      }),
    )
  })

  it('should return extracted case themes and clause candidates', async () => {
    mockComplianceCaseService.getCaseExtractionResult.mockResolvedValue({
      caseId: 'case-123',
      caseCode: 'PBOC-CASE-001',
      status: 'extracted',
      violationThemes: ['客户身份识别不到位'],
      clauseCandidates: [
        {
          clauseId: 'clause-1',
          clauseCode: 'CLAUSE-001',
        },
      ],
      extractedAt: '2026-03-26T00:00:00.000Z',
    })

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/compliance-cases/case-123/extraction')
      .expect(200)

    expect(response.body).toEqual({
      success: true,
      data: {
        caseId: 'case-123',
        caseCode: 'PBOC-CASE-001',
        status: 'extracted',
        violationThemes: ['客户身份识别不到位'],
        clauseCandidates: [
          {
            clauseId: 'clause-1',
            clauseCode: 'CLAUSE-001',
          },
        ],
        extractedAt: '2026-03-26T00:00:00.000Z',
      },
    })
  })

  it('should return clustered case themes and control mapping drafts', async () => {
    mockComplianceCaseService.getCaseClusteringResult.mockResolvedValue({
      caseId: 'case-123',
      caseCode: 'PBOC-CASE-001',
      status: 'clustered',
      normalizedThemes: ['客户身份识别'],
      candidateControlPoints: [
        {
          controlName: '交易监测',
        },
      ],
      clusteredAt: '2026-03-26T01:00:00.000Z',
      caseControlMapDrafts: [
        {
          id: 'draft-1',
          controlId: 'control-1',
          controlCode: 'CP-001',
          controlName: '客户身份识别',
          relationType: 'VIOLATES',
          reviewStatus: 'PENDING',
          confidenceScore: '0.9000',
          source: 'RULE',
        },
      ],
    })

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/compliance-cases/case-123/clustering')
      .expect(200)

    expect(response.body).toEqual({
      success: true,
      data: {
        caseId: 'case-123',
        caseCode: 'PBOC-CASE-001',
        status: 'clustered',
        normalizedThemes: ['客户身份识别'],
        candidateControlPoints: [
          {
            controlName: '交易监测',
          },
        ],
        clusteredAt: '2026-03-26T01:00:00.000Z',
        caseControlMapDrafts: [
          {
            id: 'draft-1',
            controlId: 'control-1',
            controlCode: 'CP-001',
            controlName: '客户身份识别',
            relationType: 'VIOLATES',
            reviewStatus: 'PENDING',
            confidenceScore: '0.9000',
            source: 'RULE',
          },
        ],
      },
    })
  })

  it('should return 401 for unauthenticated requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/regulation-sources')
      .expect(401)
  })

  it('should return 403 for authenticated users without required roles', async () => {
    await app.close()
    app = await createApp({ authenticated: true, roleAllowed: false })

    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/compliance-cases')
      .send({
        caseCode: 'CASE-001',
        caseTitle: '处罚案例',
      })
      .expect(403)
  })
})
