/**
 * ATDD RED PHASE — Story 5.2
 * 管理端控制点 full-context 路由脚手架
 */

import {
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { AdminControlFullContextController } from '../compliance-intelligence/controllers/admin-control-full-context.controller'
import { AuditLogService } from '../audit/audit-log.service'
import { ControlExplainService } from '../compliance-intelligence/services/control-explain.service'

const VALID_CONTROL_ID = '11111111-1111-4111-8111-111111111111'

const mockControlExplainService = {
  getAdminControlExplain: jest.fn().mockResolvedValue({
    control: {
      controlId: VALID_CONTROL_ID,
      controlCode: 'CTRL-REP-001',
      controlName: '监管报送复核控制',
    },
    governance: {
      originType: 'both',
      maturityLevel: 'hard',
      authoritativeScore: 0.8333,
    },
    applicabilityReason: '管理端详情不计算机构适用性，请在组织上下文中查看适用性说明',
    failureModes: [
      {
        failureModeId: 'fm-1',
        failureModeCode: 'FM-REP-001',
        name: '报送口径定义错误',
        category: 'DEFINITION_ERROR',
        relevance: 'PRIMARY',
      },
    ],
    obligations: [
      {
        obligationId: 'ob-1',
        obligationCode: 'OBL-IT04-4.1-01',
        obligationText: '应当建立监管报送复核机制',
        obligationType: 'MANDATORY',
        coverage: 'FULL',
      },
    ],
    reasoningChain: {
      selectedControl: {
        controlId: VALID_CONTROL_ID,
        authoritativeScore: 0.8333,
      },
    },
    clauses: [],
    cases: [],
    evidences: [],
    questions: [],
    remediations: [],
  }),
}

const mockAuditLogService = {
  log: jest.fn().mockResolvedValue(undefined),
}

async function createApp(options?: {
  authenticated?: boolean
  roleAllowed?: boolean
  userWithoutId?: boolean
  auditLogRejects?: boolean
}) {
  const authenticated = options?.authenticated ?? true
  const roleAllowed = options?.roleAllowed ?? true
  const userWithoutId = options?.userWithoutId ?? false
  const auditLogRejects = options?.auditLogRejects ?? false

  mockAuditLogService.log.mockReset()
  mockAuditLogService.log.mockImplementation(() =>
    auditLogRejects ? Promise.reject(new Error('audit unavailable')) : Promise.resolve(undefined),
  )

  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [AdminControlFullContextController],
    providers: [
      { provide: ControlExplainService, useValue: mockControlExplainService },
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
          ...(userWithoutId ? {} : { id: '770e8400-e29b-41d4-a716-446655440000' }),
          role: roleAllowed ? 'admin' : 'consultant',
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

  const app = moduleFixture.createNestApplication()
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  app.useGlobalInterceptors(new TransformInterceptor())
  await app.init()
  return app
}

describe('AdminControlFullContextController - Story 5.2 admin full-context route', () => {
  let app: INestApplication

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  it(
    '[P0][5.2-BE-001] should return GET /api/admin/knowledge-graph/control-points/:controlId/full-context without organizationId and keep the shared ControlExplainResponse shape with fixed admin applicabilityReason',
    async () => {
      app = await createApp()

      const response = await request(app.getHttpServer())
        .get(`/api/admin/knowledge-graph/control-points/${VALID_CONTROL_ID}/full-context`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toMatchObject({
        control: {
          controlId: VALID_CONTROL_ID,
          controlCode: 'CTRL-REP-001',
          controlName: '监管报送复核控制',
        },
        governance: {
          originType: 'both',
          maturityLevel: 'hard',
          authoritativeScore: 0.8333,
        },
        applicabilityReason: '管理端详情不计算机构适用性，请在组织上下文中查看适用性说明',
        failureModes: [
          expect.objectContaining({
            failureModeCode: 'FM-REP-001',
            relevance: 'PRIMARY',
          }),
        ],
        obligations: [
          expect.objectContaining({
            obligationCode: 'OBL-IT04-4.1-01',
            coverage: 'FULL',
          }),
        ],
        reasoningChain: expect.objectContaining({
          selectedControl: expect.objectContaining({
            controlId: VALID_CONTROL_ID,
            authoritativeScore: 0.8333,
          }),
        }),
      })
      expect(mockControlExplainService.getAdminControlExplain).toHaveBeenCalledWith(
        VALID_CONTROL_ID,
      )
    },
  )

  it(
    '[P1][5.2-BE-002] should return 401 when an unauthenticated user requests the admin full-context endpoint',
    async () => {
      app = await createApp({ authenticated: false })

      await request(app.getHttpServer())
        .get(`/api/admin/knowledge-graph/control-points/${VALID_CONTROL_ID}/full-context`)
        .expect(401)
    },
  )

  it('[P1][5.2-BE-004] should return 403 when a non-admin user requests the admin full-context endpoint', async () => {
    mockControlExplainService.getAdminControlExplain.mockClear()
    app = await createApp({ roleAllowed: false })

    await request(app.getHttpServer())
      .get(`/api/admin/knowledge-graph/control-points/${VALID_CONTROL_ID}/full-context`)
      .expect(403)

    expect(mockControlExplainService.getAdminControlExplain).not.toHaveBeenCalled()
  })

  it('[P1][5.2-BE-005] should return 404 when the requested control point does not exist', async () => {
    mockControlExplainService.getAdminControlExplain.mockRejectedValueOnce(
      new NotFoundException(`control_point ${VALID_CONTROL_ID} not found`),
    )
    app = await createApp()

    await request(app.getHttpServer())
      .get(`/api/admin/knowledge-graph/control-points/${VALID_CONTROL_ID}/full-context`)
      .expect(404)

    expect(mockControlExplainService.getAdminControlExplain).toHaveBeenCalledWith(
      VALID_CONTROL_ID,
    )
  })

  it('should keep returning 200 when admin audit log persistence fails', async () => {
    app = await createApp({ auditLogRejects: true })

    const response = await request(app.getHttpServer())
      .get(`/api/admin/knowledge-graph/control-points/${VALID_CONTROL_ID}/full-context`)
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(mockControlExplainService.getAdminControlExplain).toHaveBeenCalledWith(VALID_CONTROL_ID)
  })

  it('[P1][5.2-BE-003] should preserve case navigation metadata in the admin full-context response', async () => {
    mockControlExplainService.getAdminControlExplain.mockResolvedValueOnce({
      control: {
        controlId: VALID_CONTROL_ID,
        controlCode: 'CTRL-REP-001',
        controlName: '监管报送复核控制',
      },
      governance: {
        originType: 'both',
        maturityLevel: 'hard',
        authoritativeScore: 0.8333,
      },
      applicabilityReason: '管理端详情不计算机构适用性，请在组织上下文中查看适用性说明',
      failureModes: [],
      obligations: [],
      reasoningChain: {
        selectedControl: {
          controlId: VALID_CONTROL_ID,
          authoritativeScore: 0.8333,
        },
      },
      clauses: [],
      cases: [
        {
          caseId: 'case-1',
          caseCode: 'CASE-001',
          caseTitle: '某银行因报送不准被罚',
          relationType: 'VIOLATES',
          confidenceScore: '0.9100',
        },
      ],
      evidences: [],
      questions: [],
      remediations: [],
    })

    app = await createApp()

    const response = await request(app.getHttpServer())
      .get(`/api/admin/knowledge-graph/control-points/${VALID_CONTROL_ID}/full-context`)
      .expect(200)

    expect(response.body.data.cases).toEqual([
      expect.objectContaining({
        caseId: 'case-1',
        caseCode: 'CASE-001',
        caseTitle: '某银行因报送不准被罚',
        relationType: 'VIOLATES',
        confidenceScore: '0.9100',
      }),
    ])
  })

  it('should skip admin audit logging when current user id is absent', async () => {
    app = await createApp({ userWithoutId: true })

    await request(app.getHttpServer())
      .get(`/api/admin/knowledge-graph/control-points/${VALID_CONTROL_ID}/full-context`)
      .expect(200)

    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })
})
