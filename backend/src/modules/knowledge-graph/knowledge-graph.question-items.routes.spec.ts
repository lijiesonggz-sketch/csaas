import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { QuestionItemController } from './controllers/question-item.controller'
import { QuestionItemService } from './services/question-item.service'

describe('KnowledgeGraph question item controllers (http)', () => {
  let app: INestApplication

  const mockQuestionItemService = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findByControlId: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  async function createApp(options?: { authenticated?: boolean; roleAllowed?: boolean }) {
    const authenticated = options?.authenticated ?? true
    const roleAllowed = options?.roleAllowed ?? true

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuestionItemController],
      providers: [
        {
          provide: QuestionItemService,
          useValue: mockQuestionItemService,
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

  it('should create question item and write audit log', async () => {
    mockQuestionItemService.create.mockResolvedValue({
      questionId: '99999999-9999-4999-8999-999999999999',
      controlId: '11111111-1111-4111-8111-111111111111',
      questionCode: 'Q-CTRL-001',
      questionType: 'SINGLE_CHOICE',
      required: true,
    })

    const response = await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/question-items')
      .send({
        controlId: '11111111-1111-4111-8111-111111111111',
        questionCode: 'Q-CTRL-001',
        questionText: '是否建立正式制度？',
        questionType: 'SINGLE_CHOICE',
        scoringRule: {
          mode: 'single_choice',
          maxScore: 5,
        },
        required: true,
      })
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(mockAuditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entityType: 'QuestionItem',
        entityId: '99999999-9999-4999-8999-999999999999',
      }),
    )
  })

  it('should reject invalid question payloads with 400 before service execution', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/question-items')
      .send({
        controlId: 'not-a-uuid',
        questionCode: 'broken-code',
        questionText: '',
        questionType: 'BROKEN',
      })
      .expect(400)

    expect(mockQuestionItemService.create).not.toHaveBeenCalled()
    expect(mockAuditLogService.log).not.toHaveBeenCalled()
  })

  it('should return structured questions for a control point', async () => {
    mockQuestionItemService.findByControlId.mockResolvedValue({
      controlId: '22222222-2222-4222-8222-222222222222',
      questions: [
        {
          questionId: 'question-1',
          controlId: '22222222-2222-4222-8222-222222222222',
          questionCode: 'Q-CTRL-001',
          questionText: '是否建立正式制度？',
          questionType: 'SINGLE_CHOICE',
          scoringRule: {
            mode: 'single_choice',
            maxScore: 5,
          },
          required: true,
          status: 'ACTIVE',
        },
      ],
    })

    const response = await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/control-points/22222222-2222-4222-8222-222222222222/questions')
      .expect(200)

    expect(response.body).toEqual({
      success: true,
      data: {
        controlId: '22222222-2222-4222-8222-222222222222',
        questions: [
          {
            questionId: 'question-1',
            controlId: '22222222-2222-4222-8222-222222222222',
            questionCode: 'Q-CTRL-001',
            questionText: '是否建立正式制度？',
            questionType: 'SINGLE_CHOICE',
            scoringRule: {
              mode: 'single_choice',
              maxScore: 5,
            },
            required: true,
            status: 'ACTIVE',
          },
        ],
      },
    })
  })

  it('should return 401 for unauthenticated requests', async () => {
    await app.close()
    app = await createApp({ authenticated: false })

    await request(app.getHttpServer())
      .get('/api/admin/knowledge-graph/question-items')
      .expect(401)
  })

  it('should return 403 for authenticated users without required roles', async () => {
    await app.close()
    app = await createApp({ authenticated: true, roleAllowed: false })

    await request(app.getHttpServer())
      .post('/api/admin/knowledge-graph/question-items')
      .send({
        controlId: '11111111-1111-4111-8111-111111111111',
        questionCode: 'Q-CTRL-001',
        questionText: '是否建立正式制度？',
        questionType: 'SINGLE_CHOICE',
        required: true,
      })
      .expect(403)
  })
})
