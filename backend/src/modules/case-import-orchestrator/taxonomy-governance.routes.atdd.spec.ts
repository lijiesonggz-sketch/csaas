import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
  InternalServerErrorException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import {
  adminContext,
  consultantContext,
  duplicateL2Csv,
  governanceSummaryResponse,
  invalidHeaderCsv,
  mixedVersionImportRequest,
  orphanL2Csv,
  runtimeProfileExportCsv,
  runtimeProfileExportFileName,
  runtimeProfileImportRequest,
  runtimeProfileImportSuccessResponse,
  VALID_ADMIN_USER_ID,
  VALID_TENANT_ID,
  type RequestContext,
} from './testing/taxonomy-governance.atdd.fixtures'
import { TaxonomyGovernanceController } from './controllers/taxonomy-governance.controller'
import { TaxonomyGovernanceService } from './services/taxonomy-classification/taxonomy-governance.service'

type SuccessEnvelope = {
  success: boolean
  data?: Record<string, unknown> | Record<string, unknown>[]
  statusCode?: number
}

function buildHeaders(context?: RequestContext): Record<string, string> {
  const effectiveContext = {
    tenantId: VALID_TENANT_ID,
    userId: VALID_ADMIN_USER_ID,
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

describe('Story 7.4 ATDD RED - taxonomy governance routes', () => {
  let app: INestApplication

  const mockTaxonomyGovernanceService = {
    getSummary: jest.fn(),
    importRuntimeProfile: jest.fn(),
    exportRuntimeProfileCsv: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TaxonomyGovernanceController],
      providers: [
        {
          provide: TaxonomyGovernanceService,
          useValue: mockTaxonomyGovernanceService,
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
          const req = context.switchToHttp().getRequest()
          const authenticated = req.headers?.['x-test-authenticated'] !== 'false'

          if (!authenticated) {
            throw new UnauthorizedException('User not authenticated')
          }

          req.user = {
            id: req.headers?.['x-test-user-id'] ?? VALID_ADMIN_USER_ID,
            role: req.headers?.['x-test-role'] ?? 'admin',
          }

          return true
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): Record<string, unknown> } }) => {
          const req = context.switchToHttp().getRequest()
          req.tenantId = req.headers?.['x-test-tenant-id'] ?? VALID_TENANT_ID
          return true
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): Record<string, unknown> } }) => {
          const req = context.switchToHttp().getRequest()
          const role = (req.user as { role?: string } | undefined)?.role
          if (role !== 'admin') {
            throw new ForbiddenException('Only admins can mutate taxonomy governance assets')
          }
          return true
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

  async function invoke<T extends SuccessEnvelope>(runner: request.Test): Promise<T> {
    const response = await runner

    if (response.status >= 400) {
      throw {
        status: response.status,
        body: response.body,
      }
    }

    return response.body as T
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockTaxonomyGovernanceService.getSummary.mockResolvedValue(governanceSummaryResponse.data)
    mockTaxonomyGovernanceService.importRuntimeProfile.mockResolvedValue(
      runtimeProfileImportSuccessResponse.data,
    )
    mockTaxonomyGovernanceService.exportRuntimeProfileCsv.mockResolvedValue({
      fileName: runtimeProfileExportFileName,
      csvContent: runtimeProfileExportCsv,
      sourceVersion: '2026-04-28-governance-v1',
      rowCount: 2,
    })
  })

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  test('[P0][7.4-API-001] should return governance summary built from live catalog/runtime/rulebook state', async () => {
    app = await createApp()

    const response = await invoke<SuccessEnvelope>(
      request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/taxonomy-governance/summary')
        .set(buildHeaders(adminContext)),
    )

    expect(mockTaxonomyGovernanceService.getSummary).toHaveBeenCalledWith(VALID_TENANT_ID)
    expect(response).toMatchObject(governanceSummaryResponse)
  })

  test('[P0][7.4-API-002] should import a valid runtime profile snapshot, refresh cache, and emit audit log', async () => {
    app = await createApp()

    const response = await invoke<SuccessEnvelope>(
      request(app.getHttpServer())
        .post('/api/admin/knowledge-graph/taxonomy-governance/runtime-profile/import')
        .set(buildHeaders(adminContext))
        .field('sourceVersion', runtimeProfileImportRequest.sourceVersion)
        .attach('file', Buffer.from(runtimeProfileExportCsv, 'utf8'), 'runtime-profile.csv'),
    )

    expect(mockTaxonomyGovernanceService.importRuntimeProfile).toHaveBeenCalled()
    expect(response).toMatchObject(runtimeProfileImportSuccessResponse)
  })

  test('[P0][7.4-API-003] should export the current runtime profile snapshot with attachment headers', async () => {
    app = await createApp()

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/taxonomy-governance/runtime-profile/export')
      .set(buildHeaders(adminContext))

    expect(mockTaxonomyGovernanceService.exportRuntimeProfileCsv).toHaveBeenCalledWith(
      VALID_TENANT_ID,
    )
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/csv')
    expect(response.headers['content-disposition']).toContain(runtimeProfileExportFileName)
    expect(response.text).toContain('一级编码,一级类型,二级编码')
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          sourceVersion: '2026-04-28-governance-v1',
          fileName: runtimeProfileExportFileName,
          rowCount: 2,
        }),
      }),
    )
  })

  test('[P0][7.4-API-004] should reject duplicate l2Code rows instead of partially importing a broken snapshot', async () => {
    app = await createApp()
    mockTaxonomyGovernanceService.importRuntimeProfile.mockRejectedValue(
      new BadRequestException('Duplicate taxonomy runtime profile mapping for IT01-01'),
    )

    await expect(
      invoke<SuccessEnvelope>(
        request(app.getHttpServer())
          .post('/api/admin/knowledge-graph/taxonomy-governance/runtime-profile/import')
          .set(buildHeaders(adminContext))
          .field('sourceVersion', runtimeProfileImportRequest.sourceVersion)
          .attach('file', Buffer.from(duplicateL2Csv, 'utf8'), 'runtime-profile.csv'),
      ),
    ).rejects.toMatchObject({
      status: 400,
    })

    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })

  test('[P0][7.4-API-005] should reject imported l2Code values that are missing from canonical taxonomy_l2', async () => {
    app = await createApp()
    mockTaxonomyGovernanceService.importRuntimeProfile.mockRejectedValue(
      new BadRequestException(
        'Imported runtime profile row references unknown taxonomy_l2 code IT09-01',
      ),
    )

    await expect(
      invoke<SuccessEnvelope>(
        request(app.getHttpServer())
          .post('/api/admin/knowledge-graph/taxonomy-governance/runtime-profile/import')
          .set(buildHeaders(adminContext))
          .field('sourceVersion', runtimeProfileImportRequest.sourceVersion)
          .attach('file', Buffer.from(orphanL2Csv, 'utf8'), 'runtime-profile.csv'),
      ),
    ).rejects.toMatchObject({
      status: 400,
    })
  })

  test('[P0][7.4-API-006] should reject malformed or inconsistent import metadata before it can poison the live runtime snapshot', async () => {
    app = await createApp()
    mockTaxonomyGovernanceService.importRuntimeProfile.mockRejectedValue(
      new BadRequestException(
        'Runtime profile import requires a valid sourceVersion and canonical CSV headers',
      ),
    )

    await expect(
      invoke<SuccessEnvelope>(
        request(app.getHttpServer())
          .post('/api/admin/knowledge-graph/taxonomy-governance/runtime-profile/import')
          .set(buildHeaders(adminContext))
          .field('sourceVersion', mixedVersionImportRequest.sourceVersion)
          .attach('file', Buffer.from(invalidHeaderCsv, 'utf8'), 'runtime-profile.csv'),
      ),
    ).rejects.toMatchObject({
      status: 400,
    })
  })

  test('[P0][7.4-API-008] should reject blank sourceVersion before the import service is invoked', async () => {
    app = await createApp()

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-governance/runtime-profile/import')
      .set(buildHeaders(adminContext))
      .field('sourceVersion', '   ')
      .attach('file', Buffer.from(runtimeProfileExportCsv, 'utf8'), 'runtime-profile.csv')

    expect(response.status).toBe(400)
    expect(mockTaxonomyGovernanceService.importRuntimeProfile).not.toHaveBeenCalled()
  })

  test('[P0][7.4-API-009] should preserve 500 semantics when runtime profile import fails after request validation', async () => {
    app = await createApp()
    mockTaxonomyGovernanceService.importRuntimeProfile.mockRejectedValue(
      new InternalServerErrorException('Runtime profile import failed'),
    )

    await expect(
      invoke<SuccessEnvelope>(
        request(app.getHttpServer())
          .post('/api/admin/knowledge-graph/taxonomy-governance/runtime-profile/import')
          .set(buildHeaders(adminContext))
          .field('sourceVersion', runtimeProfileImportRequest.sourceVersion)
          .attach('file', Buffer.from(runtimeProfileExportCsv, 'utf8'), 'runtime-profile.csv'),
      ),
    ).rejects.toMatchObject({
      status: 500,
    })

    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })

  test('[P0][7.4-API-007] should deny consultant users from importing runtime profile snapshots', async () => {
    app = await createApp()

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/taxonomy-governance/runtime-profile/import')
      .set(buildHeaders(consultantContext))
      .field('sourceVersion', runtimeProfileImportRequest.sourceVersion)
      .attach('file', Buffer.from(runtimeProfileExportCsv, 'utf8'), 'runtime-profile.csv')

    expect(response.status).toBe(403)
    expect(mockTaxonomyGovernanceService.importRuntimeProfile).not.toHaveBeenCalled()
    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })
})
