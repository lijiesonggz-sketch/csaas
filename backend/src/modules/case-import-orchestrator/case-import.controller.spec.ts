import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { CaseImportController } from './controllers/case-import.controller'
import { CaseImportAuditFilter } from './filters/case-import-audit.filter'
import { CaseImportQueueService } from './services/case-import-queue.service'

describe('CaseImportController (http)', () => {
  let app: INestApplication

  const mockCaseImportQueueService = {
    enqueueImport: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(options?: { authenticated?: boolean; roleAllowed?: boolean }) {
    const authenticated = options?.authenticated ?? true
    const roleAllowed = options?.roleAllowed ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CaseImportController],
      providers: [
        {
          provide: CaseImportQueueService,
          useValue: mockCaseImportQueueService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        CaseImportAuditFilter,
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

  it('should create a case import job and write audit log', async () => {
    mockCaseImportQueueService.enqueueImport.mockResolvedValue({
      jobId: 'case-import-PBOC-batch-001',
      batchId: 'PBOC-batch-001',
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'PBOC',
      status: 'queued',
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/cases/import')
      .send({
        filePath: 'D:/imports/cases.xlsx',
        regulatorCode: 'PBOC',
      })
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(response.body.data).toEqual({
      jobId: 'case-import-PBOC-batch-001',
      batchId: 'PBOC-batch-001',
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'PBOC',
      status: 'queued',
    })
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entityType: 'ComplianceCaseImportJob',
        entityId: 'case-import-PBOC-batch-001',
      }),
    )
  })

  it('should reject invalid import payloads with 400 before queue submission', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/cases/import')
      .send({
        filePath: '',
      })
      .expect(400)

    expect(mockCaseImportQueueService.enqueueImport).not.toHaveBeenCalled()
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'ComplianceCaseImportJob',
        entityId: null,
      }),
    )
  })

  it('should return 401 for unauthenticated requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/cases/import')
      .send({
        filePath: 'D:/imports/cases.xlsx',
        regulatorCode: 'PBOC',
      })
      .expect(401)

    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'ComplianceCaseImportJob',
        entityId: null,
      }),
    )
  })

  it('should return 403 for authenticated users without required roles', async () => {
    await app.close()
    app = await createApp({ authenticated: true, roleAllowed: false })

    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/cases/import')
      .send({
        filePath: 'D:/imports/cases.xlsx',
        regulatorCode: 'PBOC',
      })
      .expect(403)

    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'ComplianceCaseImportJob',
        entityId: null,
      }),
    )
  })
})
