/**
 * ATDD Acceptance Tests — Story 1-4: FailureModeController 路由测试
 *
 * 覆盖 AC: 2 (6 REST 端点), 4 (权限控制), 5 (审计日志)
 *
 * 端点:
 * - GET    /api/admin/knowledge-graph/failure-modes              — 列表
 * - GET    /api/admin/knowledge-graph/failure-modes/:id          — 详情
 * - POST   /api/admin/knowledge-graph/failure-modes              — 创建
 * - PATCH  /api/admin/knowledge-graph/failure-modes/:id          — 更新
 * - GET    /api/admin/knowledge-graph/failure-modes/by-taxonomy/:l2Code — 按分类
 * - GET    /api/admin/knowledge-graph/failure-modes/:id/control-points  — 控制点
 *
 * Run: npx jest --testPathPattern="failure-modes.routes" --no-coverage
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

// ---------------------------------------------------------------------------
// Dynamic imports — controller and service do not exist yet (TDD red phase)
// ---------------------------------------------------------------------------

const loadController = async () => {
  const mod = await import('./controllers/failure-mode.controller')
  return mod.FailureModeController
}

const loadService = async () => {
  const mod = await import('./services/failure-mode.service')
  return mod.FailureModeService
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFailureModeService = {
  findAll: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
  findById: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue(null),
  findByL2Code: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
  findControlPointsByFailureMode: jest
    .fn()
    .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
  createTaxonomyMap: jest.fn().mockResolvedValue(null),
  createControlMap: jest.fn().mockResolvedValue(null),
  deleteTaxonomyMap: jest.fn().mockResolvedValue({ success: true, id: 'map-uuid-1' }),
  deleteControlMap: jest.fn().mockResolvedValue({ success: true, id: 'cmap-uuid-1' }),
}

const mockAuditLogService = {
  log: jest.fn().mockResolvedValue(undefined),
}

async function createApp(options?: { authenticated?: boolean; roleAllowed?: boolean }) {
  const authenticated = options?.authenticated ?? true
  const roleAllowed = options?.roleAllowed ?? true

  const FailureModeControllerClass = await loadController()

  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [FailureModeControllerClass],
    providers: [
      { provide: await loadService(), useValue: mockFailureModeService },
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

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('KnowledgeGraph failure-modes controllers (http)', () => {
  let app: INestApplication

  beforeEach(async () => {
    jest.clearAllMocks()
    app = await createApp()
  })

  afterEach(async () => {
    await app.close()
  })

  // =========================================================================
  // GET /failure-modes — 列表查询 (AC: 2)
  // =========================================================================

  describe('[P0][AC-2] GET /failure-modes', () => {
    it('should return paginated failure modes list', async () => {
      const mockData = {
        items: [
          {
            failureModeId: 'fm-1',
            failureModeCode: 'FM-DEF-001',
            name: '定义错误',
            category: 'DEFINITION_ERROR',
            status: 'ACTIVE',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      }
      mockFailureModeService.findAll.mockResolvedValue(mockData)

      const response = await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/failure-modes')
        .query({ page: 1, limit: 20 })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toHaveLength(1)
      expect(response.body.data.total).toBe(1)
    })

    it('should pass category/status/keyword filters to service', async () => {
      mockFailureModeService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

      await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/failure-modes')
        .query({ category: 'DEFINITION_ERROR', status: 'ACTIVE', keyword: '数据' })
        .expect(200)

      expect(mockFailureModeService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'DEFINITION_ERROR',
          status: 'ACTIVE',
          keyword: '数据',
        }),
      )
    })
  })

  // =========================================================================
  // GET /failure-modes/:id — 详情 (AC: 2, 3)
  // =========================================================================

  describe('[P0][AC-2][AC-3] GET /failure-modes/:id', () => {
    it('should return failure mode detail with taxonomyMaps and controlMaps', async () => {
      const mockDetail = {
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
        name: '数据定义错误',
        description: '描述',
        category: 'DEFINITION_ERROR',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        taxonomyMaps: [{ id: 'map-1', l2Code: 'IT04.01', l2Name: '监管数据报送', notes: null }],
        controlMaps: [
          {
            id: 'cmap-1',
            controlId: 'ctrl-1',
            controlCode: 'CTRL-REP-001',
            controlName: '数据报送前校验',
            relevance: 'PRIMARY',
            maturityLevel: 'hard',
            authoritativeScore: 0.8333,
          },
        ],
      }
      mockFailureModeService.findById.mockResolvedValue(mockDetail)

      const response = await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/failure-modes/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.taxonomyMaps).toBeDefined()
      expect(response.body.data.controlMaps).toBeDefined()
    })
  })

  // =========================================================================
  // POST /failure-modes — 创建 (AC: 2, 5)
  // =========================================================================

  describe('[P0][AC-2][AC-5] POST /failure-modes', () => {
    it('should create failure mode and write audit log', async () => {
      const created = {
        failureModeId: 'fm-new-uuid',
        failureModeCode: 'FM-NEW-001',
        name: '新失效模式',
        category: 'MAPPING_ERROR',
        status: 'ACTIVE',
      }
      mockFailureModeService.create.mockResolvedValue(created)

      const response = await request(app.getHttpServer())
        .post('/api/admin/knowledge-graph/failure-modes')
        .send({
          failureModeCode: 'FM-NEW-001',
          name: '新失效模式',
          category: 'MAPPING_ERROR',
        })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entityType: 'FailureMode',
          entityId: 'fm-new-uuid',
        }),
      )
    })

    it('should reject invalid payload with 400 before service execution', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/knowledge-graph/failure-modes')
        .send({
          category: 'INVALID_CATEGORY',
        })
        .expect(400)

      expect(mockFailureModeService.create).not.toHaveBeenCalled()
      expect(mockAuditLogService.log).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // PATCH /failure-modes/:id — 更新 (AC: 2, 5)
  // =========================================================================

  describe('[P0][AC-2][AC-5] PATCH /failure-modes/:id', () => {
    it('should update failure mode and write audit log', async () => {
      const updated = {
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
        name: '更新后名称',
        category: 'DEFINITION_ERROR',
        status: 'ACTIVE',
      }
      mockFailureModeService.update.mockResolvedValue(updated)

      const response = await request(app.getHttpServer())
        .patch('/api/admin/knowledge-graph/failure-modes/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
        .send({ name: '更新后名称' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          entityType: 'FailureMode',
          entityId: 'fm-uuid-1',
        }),
      )
    })
  })

  // =========================================================================
  // GET /failure-modes/by-taxonomy/:l2Code — 按分类 (AC: 2)
  // =========================================================================

  describe('[P0][AC-2] GET /failure-modes/by-taxonomy/:l2Code', () => {
    it('should return failure modes filtered by taxonomy l2Code', async () => {
      const mockData = {
        items: [
          {
            failureModeId: 'fm-1',
            failureModeCode: 'FM-REP-001',
            name: '报送错误',
            category: 'DEFINITION_ERROR',
            status: 'ACTIVE',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      }
      mockFailureModeService.findByL2Code.mockResolvedValue(mockData)

      const response = await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/failure-modes/by-taxonomy/IT04.01')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items).toHaveLength(1)
      expect(mockFailureModeService.findByL2Code).toHaveBeenCalledWith('IT04.01', expect.anything())
    })
  })

  // =========================================================================
  // GET /failure-modes/:id/control-points — 控制点 (AC: 2)
  // =========================================================================

  describe('[P0][AC-2] GET /failure-modes/:id/control-points', () => {
    it('should return control points for a failure mode with governance fields', async () => {
      const mockData = {
        items: [
          {
            id: 'cmap-1',
            controlId: 'ctrl-1',
            controlCode: 'CTRL-REP-001',
            controlName: '数据报送前校验',
            relevance: 'PRIMARY',
            maturityLevel: 'hard',
            authoritativeScore: 0.8333,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      }
      mockFailureModeService.findControlPointsByFailureMode.mockResolvedValue(mockData)

      const response = await request(app.getHttpServer())
        .get(
          '/api/admin/knowledge-graph/failure-modes/a1b2c3d4-e5f6-7890-abcd-ef1234567890/control-points',
        )
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.items[0]).toEqual(
        expect.objectContaining({
          relevance: 'PRIMARY',
          maturityLevel: 'hard',
          authoritativeScore: 0.8333,
        }),
      )
    })
  })

  // =========================================================================
  // 权限控制 (AC: 4)
  // =========================================================================

  describe('[P0][AC-4] Authentication & Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      await app.close()
      app = await createApp({ authenticated: false })

      await request(app.getHttpServer()).get('/api/admin/knowledge-graph/failure-modes').expect(401)
    })

    it('should return 403 for POST endpoint without required role', async () => {
      await app.close()
      app = await createApp({ authenticated: true, roleAllowed: false })

      await request(app.getHttpServer())
        .post('/api/admin/knowledge-graph/failure-modes')
        .send({
          failureModeCode: 'FM-TEST',
          name: '测试',
          category: 'DEFINITION_ERROR',
        })
        .expect(403)
    })

    it('should return 403 for PATCH endpoint without required role', async () => {
      await app.close()
      app = await createApp({ authenticated: true, roleAllowed: false })

      await request(app.getHttpServer())
        .patch('/api/admin/knowledge-graph/failure-modes/b2c3d4e5-f6a7-8901-bcde-f12345678901')
        .send({ name: '不允许' })
        .expect(403)
    })
  })

  // =========================================================================
  // POST /failure-modes/:id/taxonomy-maps — 添加分类映射 (额外实现)
  // =========================================================================

  describe('[P1] POST /failure-modes/:id/taxonomy-maps', () => {
    it('should create taxonomy map and write audit log', async () => {
      const created = {
        id: 'map-uuid-1',
        failureModeId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        l2Code: 'IT04.01',
        notes: '测试映射',
      }
      mockFailureModeService.createTaxonomyMap.mockResolvedValue(created)

      const response = await request(app.getHttpServer())
        .post(
          '/api/admin/knowledge-graph/failure-modes/a1b2c3d4-e5f6-7890-abcd-ef1234567890/taxonomy-maps',
        )
        .send({ l2Code: 'IT04.01', notes: '测试映射' })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entityType: 'TaxonomyFailureModeMap',
        }),
      )
    })
  })

  // =========================================================================
  // POST /failure-modes/:id/control-maps — 添加控制点映射 (额外实现)
  // =========================================================================

  describe('[P1] POST /failure-modes/:id/control-maps', () => {
    it('should create control map and write audit log', async () => {
      const created = {
        id: 'cmap-uuid-1',
        failureModeId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        controlId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        relevance: 'PRIMARY',
        notes: null,
      }
      mockFailureModeService.createControlMap.mockResolvedValue(created)

      const response = await request(app.getHttpServer())
        .post(
          '/api/admin/knowledge-graph/failure-modes/a1b2c3d4-e5f6-7890-abcd-ef1234567890/control-maps',
        )
        .send({
          controlId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          relevance: 'PRIMARY',
        })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entityType: 'FailureModeControlMap',
        }),
      )
    })
  })

  describe('[P1] DELETE /failure-modes/:id/taxonomy-maps/:mapId', () => {
    it('should delete taxonomy map and write audit log', async () => {
      const response = await request(app.getHttpServer())
        .delete(
          '/api/admin/knowledge-graph/failure-modes/a1b2c3d4-e5f6-7890-abcd-ef1234567890/taxonomy-maps/b1b2c3d4-e5f6-7890-abcd-ef1234567890',
        )
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(mockFailureModeService.deleteTaxonomyMap).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'b1b2c3d4-e5f6-7890-abcd-ef1234567890',
      )
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.DELETE,
          entityType: 'TaxonomyFailureModeMap',
        }),
      )
    })
  })

  describe('[P1] DELETE /failure-modes/:id/control-maps/:mapId', () => {
    it('should delete control map and write audit log', async () => {
      const response = await request(app.getHttpServer())
        .delete(
          '/api/admin/knowledge-graph/failure-modes/a1b2c3d4-e5f6-7890-abcd-ef1234567890/control-maps/c1b2c3d4-e5f6-7890-abcd-ef1234567890',
        )
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(mockFailureModeService.deleteControlMap).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c1b2c3d4-e5f6-7890-abcd-ef1234567890',
      )
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.DELETE,
          entityType: 'FailureModeControlMap',
        }),
      )
    })
  })
})
