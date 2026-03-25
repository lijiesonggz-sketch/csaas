import {
  BadRequestException,
  ConflictException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import {
  adminContext,
  consultantContext,
  controlPointListFilteredResponse,
  duplicateControlCodeRequest,
  duplicateControlNameRequest,
  expectedCreateAuditLogCall,
  expectedCreatedControlPoint,
  expectedStatusAuditLogCall,
  expectedStatusPatchedControlPoint,
  invalidParentRelationRequest,
  statusPatchRequest,
  taxonomyTreeResponse,
  validCreateControlPointRequest,
  VALID_TENANT_ID,
  VALID_USER_ID,
  VALID_CONTROL_ID,
} from './testing/atdd-story-2-1.fixtures'
import { AuditLogService } from '../audit/audit-log.service'
import { ControlPointController } from './controllers/control-point.controller'
import { TaxonomyController } from './controllers/taxonomy.controller'
import { ControlPointService } from './services/control-point.service'
import { TaxonomyService } from './services/taxonomy.service'

type RequestContext = {
  tenantId?: string
  userId?: string
  authenticated?: boolean
  role?: string
}

type KnowledgeGraphHttpResponse = {
  success: boolean
  data?: Record<string, unknown> | Record<string, unknown>[]
  statusCode?: number
}

type KnowledgeGraphApiSubject = {
  taxonomyService: {
    getTree: jest.Mock
  }
  controlPointService: {
    create: jest.Mock
    updateStatus: jest.Mock
    findAll: jest.Mock
  }
  auditLogService: {
    log: jest.Mock
  }
  getTaxonomyTree: (context?: RequestContext) => Promise<KnowledgeGraphHttpResponse>
  createControlPoint: (
    body: Record<string, unknown>,
    context?: RequestContext,
  ) => Promise<KnowledgeGraphHttpResponse>
  listControlPoints: (
    query?: Record<string, unknown>,
    context?: RequestContext,
  ) => Promise<KnowledgeGraphHttpResponse>
  patchControlPointStatus: (
    controlId: string,
    body: Record<string, unknown>,
    context?: RequestContext,
  ) => Promise<KnowledgeGraphHttpResponse>
  close: () => Promise<void>
}

function buildHeaders(context?: RequestContext): Record<string, string> {
  const effectiveContext = {
    tenantId: VALID_TENANT_ID,
    userId: VALID_USER_ID,
    authenticated: true,
    role: 'admin',
    ...context,
  }

  return {
    'x-test-authenticated': String(effectiveContext.authenticated),
    'x-test-role': effectiveContext.role,
    'x-test-tenant-id': effectiveContext.tenantId,
    'x-test-user-id': effectiveContext.userId,
  }
}

describe('Story 2.1 ATDD GREEN - knowledge-graph catalog routes', () => {
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

  async function createApp(): Promise<INestApplication> {
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
        canActivate: (context: {
          switchToHttp(): { getRequest(): Record<string, unknown> }
        }) => {
          const req = context.switchToHttp().getRequest()
          const authenticated = req.headers?.['x-test-authenticated'] !== 'false'

          if (!authenticated) {
            throw new UnauthorizedException('User not authenticated')
          }

          req.user = {
            id: req.headers?.['x-test-user-id'] ?? VALID_USER_ID,
            role: req.headers?.['x-test-role'] ?? 'admin',
          }

          return true
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp(): { getRequest(): Record<string, unknown> }
        }) => {
          const req = context.switchToHttp().getRequest()
          req.tenantId = req.headers?.['x-test-tenant-id'] ?? VALID_TENANT_ID
          return true
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp(): { getRequest(): Record<string, unknown> }
        }) => {
          const req = context.switchToHttp().getRequest()
          const user = req.user as { role?: string } | undefined
          return ['admin', 'consultant'].includes(user?.role ?? '')
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

  async function invoke<T extends KnowledgeGraphHttpResponse>(
    runner: request.Test,
  ): Promise<T> {
    const response = await runner

    if (response.status >= 400) {
      throw {
        status: response.status,
        body: response.body,
      }
    }

    return response.body as T
  }

  async function createSubject(): Promise<KnowledgeGraphApiSubject> {
    app = await createApp()

    return {
      taxonomyService: mockTaxonomyService,
      controlPointService: mockControlPointService,
      auditLogService: mockAuditLogService,
      getTaxonomyTree: (context?: RequestContext) =>
        invoke(
          request(app.getHttpServer())
            .get('/api/admin/knowledge-graph/taxonomy/tree')
            .set(buildHeaders(context))
            .query({ status: 'ACTIVE' }),
        ),
      createControlPoint: (body: Record<string, unknown>, context?: RequestContext) =>
        invoke(
          request(app.getHttpServer())
            .post('/api/admin/knowledge-graph/control-points')
            .set(buildHeaders(context))
            .send(body),
        ),
      listControlPoints: (query?: Record<string, unknown>, context?: RequestContext) =>
        invoke(
          request(app.getHttpServer())
            .get('/api/admin/knowledge-graph/control-points')
            .set(buildHeaders(context))
            .query(query ?? {}),
        ),
      patchControlPointStatus: (
        controlId: string,
        body: Record<string, unknown>,
        context?: RequestContext,
      ) =>
        invoke(
          request(app.getHttpServer())
            .patch(`/api/admin/knowledge-graph/control-points/${controlId}/status`)
            .set(buildHeaders(context))
            .send(body),
        ),
      close: () => app.close(),
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockTaxonomyService.getTree.mockResolvedValue(taxonomyTreeResponse.data)
    mockControlPointService.findAll.mockResolvedValue(controlPointListFilteredResponse.data)
    mockControlPointService.updateStatus.mockResolvedValue(expectedStatusPatchedControlPoint)
    mockControlPointService.create.mockImplementation(async (dto: typeof validCreateControlPointRequest) => {
      if (dto.l1Code === invalidParentRelationRequest.l1Code && dto.l2Code === invalidParentRelationRequest.l2Code) {
        throw new BadRequestException('Invalid l1Code/l2Code hierarchy relation')
      }

      if (dto.controlCode === duplicateControlCodeRequest.controlCode) {
        throw new ConflictException(`control_code ${dto.controlCode} already exists`)
      }

      if (dto.controlName === duplicateControlNameRequest.controlName) {
        throw new ConflictException(`control_name ${dto.controlName} already exists`)
      }

      return expectedCreatedControlPoint
    })
  })

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  test('[P0][2.1-API-001] should return the admin taxonomy tree with L1->L2 hierarchy and stable success envelope', async () => {
    const subject = await createSubject()

    const response = await subject.getTaxonomyTree(adminContext)

    expect(subject.taxonomyService.getTree).toHaveBeenCalledWith({
      status: 'ACTIVE',
    })
    expect(response).toMatchObject(taxonomyTreeResponse)
  })

  test('[P0][2.1-API-002] should create a control point with the full metadata contract and emit a CREATE audit log payload', async () => {
    const subject = await createSubject()

    const response = await subject.createControlPoint(validCreateControlPointRequest, adminContext)

    expect(subject.controlPointService.create).toHaveBeenCalledWith(validCreateControlPointRequest)
    expect(response).toMatchObject({
      success: true,
      data: expectedCreatedControlPoint,
    })
    expect(subject.auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining(expectedCreateAuditLogCall),
    )
  })

  test('[P0][2.1-API-003] should reject an l1Code/l2Code hierarchy mismatch with HTTP 400 and avoid writing any audit record', async () => {
    const subject = await createSubject()

    await expect(
      subject.createControlPoint(invalidParentRelationRequest, consultantContext),
    ).rejects.toMatchObject({
      status: 400,
    })

    expect(subject.controlPointService.create).toHaveBeenCalledWith(invalidParentRelationRequest)
    expect(subject.auditLogService.log).not.toHaveBeenCalled()
  })

  test('[P0][2.1-API-004] should reject duplicate controlCode with HTTP 409 and must not silently overwrite catalog master data', async () => {
    const subject = await createSubject()

    await expect(
      subject.createControlPoint(duplicateControlCodeRequest, adminContext),
    ).rejects.toMatchObject({
      status: 409,
    })

    expect(subject.controlPointService.create).toHaveBeenCalledWith(duplicateControlCodeRequest)
    expect(subject.auditLogService.log).not.toHaveBeenCalled()
  })

  test('[P0][2.1-API-005] should reject duplicate controlName with HTTP 409 and keep duplicate directory items out of the catalog', async () => {
    const subject = await createSubject()

    await expect(
      subject.createControlPoint(duplicateControlNameRequest, consultantContext),
    ).rejects.toMatchObject({
      status: 409,
    })

    expect(subject.controlPointService.create).toHaveBeenCalledWith(duplicateControlNameRequest)
    expect(subject.auditLogService.log).not.toHaveBeenCalled()
  })

  test('[P0][2.1-API-006] should return HTTP 401 for unauthenticated requests and HTTP 403 for authenticated users without ADMIN or CONSULTANT roles', async () => {
    const subject = await createSubject()

    await expect(
      subject.getTaxonomyTree({
        authenticated: false,
      }),
    ).rejects.toMatchObject({
      status: 401,
    })

    await expect(
      subject.createControlPoint(validCreateControlPointRequest, {
        ...adminContext,
        role: 'respondent',
      }),
    ).rejects.toMatchObject({
      status: 403,
    })

    expect(subject.controlPointService.create).not.toHaveBeenCalled()
    expect(subject.auditLogService.log).not.toHaveBeenCalled()
  })

  test('[P1][2.1-API-007] should PATCH control point status without deleting the record and must emit an UPDATE audit log describing the status change', async () => {
    const subject = await createSubject()

    const response = await subject.patchControlPointStatus(
      VALID_CONTROL_ID,
      statusPatchRequest,
      adminContext,
    )

    expect(subject.controlPointService.updateStatus).toHaveBeenCalledWith(
      VALID_CONTROL_ID,
      statusPatchRequest,
    )
    expect(response).toMatchObject({
      success: true,
      data: expectedStatusPatchedControlPoint,
    })
    expect(subject.auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining(expectedStatusAuditLogCall),
    )
  })

  test('[P1][2.1-API-008] should support status, l1Code, l2Code, controlFamily and keyword filters on the admin control-point listing endpoint', async () => {
    const subject = await createSubject()

    const query = {
      status: 'ACTIVE',
      l1Code: 'IT02',
      l2Code: 'IT02-03',
      controlFamily: 'ACC_PRIVILEGED',
      keyword: 'privileged',
    }
    const response = await subject.listControlPoints(query, consultantContext)

    expect(subject.controlPointService.findAll).toHaveBeenCalledWith(
      expect.objectContaining(query),
    )
    expect(response).toMatchObject(controlPointListFilteredResponse)
  })
})
