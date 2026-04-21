/**
 * ATDD Acceptance Tests — Story 5.1: Reasoning Chain API 路由测试
 */

import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { KnowledgeGraphController } from './controllers/knowledge-graph.controller'
import { RegulationService } from './services/regulation.service'
import { TaxonomyService } from './services/taxonomy.service'

const mockTaxonomyService = {
  getReasoningChain: jest.fn().mockResolvedValue({
    taxonomy: { l1Code: 'IT01', l1Name: '战略与治理', l2Code: 'IT01-01', l2Name: 'IT战略规划' },
    failureModes: [
      { failureModeId: 'fm-1', failureModeCode: 'FM-IT01-001', name: 'IT战略与业务战略不一致', category: 'DEFINITION_ERROR', controlPointCount: 3 },
    ],
    controlPoints: [
      { controlId: 'cp-1', controlCode: 'CP-IT01-001', controlName: 'IT战略规划流程', maturityLevel: 'hard', authoritativeScore: 95, originType: 'both', failureModeRelevance: 'PRIMARY', failureModeId: 'fm-1' },
    ],
    obligations: [
      { obligationId: 'ob-1', obligationCode: 'OBL-IT01-001', obligationText: '应当建立IT战略规划流程', obligationType: 'MANDATORY', controlId: 'cp-1', coverage: 'FULL' },
    ],
  }),
}

const mockRegulationService = {
  getRegulationGraph: jest.fn().mockResolvedValue({
    source: {
      sourceId: '550e8400-e29b-41d4-a716-446655440000',
      sourceCode: 'SRC-001',
      sourceName: '监管指引',
      sourceLevel: 'guideline',
      authorityName: '监管机构',
      clauseCount: 1,
      obligationCount: 1,
      controlPointCount: 1,
    },
    clauses: [
      {
        clauseId: 'clause-1',
        clauseCode: 'CLAUSE-001',
        articleNo: '4.1',
        sectionPath: '第四条/第一款',
        clauseText: '应当建立复核机制',
        clauseSummary: '建立复核机制',
        mandatoryLevel: 'MUST',
        obligationCount: 1,
        controlPointCount: 1,
      },
    ],
    obligations: [
      {
        obligationId: 'ob-1',
        obligationCode: 'OBL-001',
        obligationText: '应当建立复核机制',
        obligationType: 'MANDATORY',
        applicableSector: ['银行'],
        clauseId: 'clause-1',
        clauseCode: 'CLAUSE-001',
        clauseSummary: '建立复核机制',
        controlPointCount: 1,
      },
    ],
    controlPoints: [
      {
        edgeId: 'clause-1:ob-1:cp-1',
        controlId: 'cp-1',
        controlCode: 'CP-001',
        controlName: '监管报送复核控制',
        maturityLevel: 'hard',
        authoritativeScore: 92,
        originType: 'regulation_derived',
        applicableSector: ['银行'],
        coverage: 'FULL',
        obligationId: 'ob-1',
        obligationCode: 'OBL-001',
        clauseId: 'clause-1',
        clauseCode: 'CLAUSE-001',
      },
    ],
  }),
}
/* PLACEHOLDER_ATDD_TESTS */

async function createApp(options?: { authenticated?: boolean; roleAllowed?: boolean }) {
  const authenticated = options?.authenticated ?? true
  const roleAllowed = options?.roleAllowed ?? true

  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [KnowledgeGraphController],
    providers: [
      { provide: TaxonomyService, useValue: mockTaxonomyService },
      { provide: RegulationService, useValue: mockRegulationService },
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

describe('KnowledgeGraphController - Reasoning Chain API (Story 5.1 ATDD)', () => {
  let app: INestApplication

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  describe('GET /api/admin/knowledge-graph/reasoning-chain/:l2Code', () => {
    it('[P0] 应该返回完整的推理链路数据', async () => {
      app = await createApp()

      const response = await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/reasoning-chain/IT01-01')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('taxonomy')
      expect(response.body.data).toHaveProperty('failureModes')
      expect(response.body.data).toHaveProperty('controlPoints')
      expect(response.body.data).toHaveProperty('obligations')

      // 验证 taxonomy 字段
      expect(response.body.data.taxonomy.l2Code).toBe('IT01-01')
      expect(response.body.data.taxonomy.l2Name).toBe('IT战略规划')
      expect(response.body.data.taxonomy.l1Code).toBe('IT01')

      // 验证 failureModes 数组
      expect(Array.isArray(response.body.data.failureModes)).toBe(true)
      expect(response.body.data.failureModes.length).toBeGreaterThan(0)
      expect(response.body.data.failureModes[0]).toHaveProperty('failureModeId')
      expect(response.body.data.failureModes[0]).toHaveProperty('failureModeCode')

      // 验证 controlPoints 数组
      expect(Array.isArray(response.body.data.controlPoints)).toBe(true)
      expect(response.body.data.controlPoints.length).toBeGreaterThan(0)
      expect(response.body.data.controlPoints[0]).toHaveProperty('controlId')
      expect(response.body.data.controlPoints[0]).toHaveProperty('controlCode')

      // 验证 obligations 数组
      expect(Array.isArray(response.body.data.obligations)).toBe(true)
      expect(response.body.data.obligations[0]).toHaveProperty('obligationId')
    })

    it('[P1] 应该返回 401 当用户未认证', async () => {
      app = await createApp({ authenticated: false })

      await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/reasoning-chain/IT01-01')
        .expect(401)
    })

    it('[P1] 应该返回 403 当用户不是管理员', async () => {
      app = await createApp({ roleAllowed: false })

      await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/reasoning-chain/IT01-01')
        .expect(403)
    })
  })

  describe('GET /api/admin/knowledge-graph/regulation-graph/:sourceId', () => {
    it('[P0] 应该返回完整的法规驱动线数据', async () => {
      app = await createApp()

      const response = await request(app.getHttpServer())
        .get('/api/admin/knowledge-graph/regulation-graph/550e8400-e29b-41d4-a716-446655440000')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.source.sourceCode).toBe('SRC-001')
      expect(response.body.data.clauses[0].clauseCode).toBe('CLAUSE-001')
      expect(response.body.data.obligations[0].obligationCode).toBe('OBL-001')
      expect(response.body.data.controlPoints[0].controlCode).toBe('CP-001')
    })
  })
})
