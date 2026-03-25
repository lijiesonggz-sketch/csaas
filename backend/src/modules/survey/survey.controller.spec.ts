import 'reflect-metadata'
import {
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as request from 'supertest'
import { AuditLogService } from '../audit/audit-log.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { OrganizationGuard } from '../organizations/guards/organization.guard'
import { TenantGuard } from '../organizations/guards/tenant.guard'
import { ActionPlanGenerationService } from './action-plan-generation.service'
import { ActionPlanService } from './action-plan.service'
import { BinaryGapAnalyzer } from './binary-gap-analyzer.service'
import { MaturityAnalysisService } from './maturity-analysis.service'
import { ProjectQuestionnaireSnapshotService } from './project-questionnaire-snapshot.service'
import { SurveyController } from './survey.controller'
import { SurveyService } from './survey.service'

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440320'
const ORG_ID = '660e8400-e29b-41d4-a716-446655440320'
const TENANT_ID = '770e8400-e29b-41d4-a716-446655440320'
const USER_ID = '880e8400-e29b-41d4-a716-446655440320'

describe('SurveyController snapshot endpoints', () => {
  let app: INestApplication
  let snapshotService: { createSnapshot: jest.Mock; getSnapshot: jest.Mock }
  let auditLogService: { log: jest.Mock }

  async function createApp(): Promise<INestApplication> {
    snapshotService = {
      createSnapshot: jest.fn().mockResolvedValue({
        projectId: PROJECT_ID,
        organizationId: ORG_ID,
        questionnaireTaskId: 'snapshot-task-id',
        generatedAt: '2026-03-25T16:30:00.000Z',
        snapshotVersion: 1,
        resolvedControlSetVersion: 'resolved-controls@2026-03-25T16:30:00.000Z',
        questionSetVersion: 'question-set@2026-03-25T16:30:00.000Z',
        sourceControlIds: ['control-a'],
        missingQuestionControlIds: [],
        reusedExisting: false,
        questions: [
          {
            question_id: 'Q-ACC-001',
            cluster_id: 'control-a',
            cluster_name: '特权账号控制',
            question_text: '机构是否建立特权账号定期复核机制？',
            question_type: 'SINGLE_CHOICE',
            options: [
              { option_id: 'A', text: 'yes', score: 5 },
              { option_id: 'B', text: 'not_yes', score: 0 },
            ],
            required: true,
            guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
          },
        ],
      }),
      getSnapshot: jest.fn().mockResolvedValue({
        projectId: PROJECT_ID,
        organizationId: ORG_ID,
        questionnaireTaskId: 'snapshot-task-id',
        generatedAt: '2026-03-25T16:30:00.000Z',
        snapshotVersion: 1,
        resolvedControlSetVersion: 'resolved-controls@2026-03-25T16:30:00.000Z',
        questionSetVersion: 'question-set@2026-03-25T16:30:00.000Z',
        sourceControlIds: ['control-a'],
        missingQuestionControlIds: [],
        reusedExisting: true,
        questions: [
          {
            question_id: 'Q-ACC-001',
          },
        ],
      }),
    }
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [SurveyController],
      providers: [
        {
          provide: SurveyService,
          useValue: {},
        },
        {
          provide: MaturityAnalysisService,
          useValue: {},
        },
        {
          provide: ActionPlanGenerationService,
          useValue: {},
        },
        {
          provide: ActionPlanService,
          useValue: {},
        },
        {
          provide: BinaryGapAnalyzer,
          useValue: {},
        },
        {
          provide: ProjectQuestionnaireSnapshotService,
          useValue: snapshotService,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.user = { id: USER_ID, userId: USER_ID }
          return true
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.tenantId = TENANT_ID
          return true
        },
      })
      .overrideGuard(OrganizationGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.orgId = ORG_ID
          return true
        },
      })
      .compile()

    const testApp = moduleRef.createNestApplication()
    testApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    await testApp.init()

    return testApp
  }

  afterEach(async () => {
    jest.clearAllMocks()
    if (app) {
      await app.close()
    }
  })

  it('should create a project questionnaire snapshot and write an audit log', async () => {
    app = await createApp()

    const response = await request(app.getHttpServer())
      .post('/survey/project-questionnaire-snapshot')
      .send({
        projectId: PROJECT_ID,
      })
      .expect(200)

    expect(snapshotService.createSnapshot).toHaveBeenCalledWith(
      {
        projectId: PROJECT_ID,
      },
      ORG_ID,
    )
    expect(response.body).toMatchObject({
      success: true,
      data: {
        questionnaireTaskId: 'snapshot-task-id',
        snapshotVersion: 1,
      },
    })
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        entityType: 'ProjectQuestionnaireSnapshot',
        entityId: 'snapshot-task-id',
      }),
    )
  })

  it('should read an existing project questionnaire snapshot and write a READ audit log', async () => {
    app = await createApp()

    const response = await request(app.getHttpServer())
      .get(`/survey/project-questionnaire-snapshot/${PROJECT_ID}`)
      .expect(200)

    expect(snapshotService.getSnapshot).toHaveBeenCalledWith(PROJECT_ID, ORG_ID)
    expect(response.body).toMatchObject({
      success: true,
      data: {
        questionnaireTaskId: 'snapshot-task-id',
        reusedExisting: true,
      },
    })
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'read',
        entityType: 'ProjectQuestionnaireSnapshot',
        entityId: 'snapshot-task-id',
      }),
    )
  })

  it('should reject invalid payload on the snapshot creation route', async () => {
    app = await createApp()

    await request(app.getHttpServer())
      .post('/survey/project-questionnaire-snapshot')
      .send({
        projectId: 'not-a-uuid',
        unexpectedField: 'nope',
      })
      .expect(400)

    expect(snapshotService.createSnapshot).not.toHaveBeenCalled()
  })

  it('should return 404 when the snapshot service surfaces a missing project', async () => {
    app = await createApp()
    snapshotService.createSnapshot.mockRejectedValue(
      new NotFoundException(`Project ${PROJECT_ID} not found`),
    )

    await request(app.getHttpServer())
      .post('/survey/project-questionnaire-snapshot')
      .send({
        projectId: PROJECT_ID,
      })
      .expect(404)
  })

  it('should return 401 for unauthenticated snapshot requests', async () => {
    snapshotService = {
      createSnapshot: jest.fn(),
      getSnapshot: jest.fn(),
    }
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [SurveyController],
      providers: [
        { provide: SurveyService, useValue: {} },
        { provide: MaturityAnalysisService, useValue: {} },
        { provide: ActionPlanGenerationService, useValue: {} },
        { provide: ActionPlanService, useValue: {} },
        { provide: BinaryGapAnalyzer, useValue: {} },
        { provide: ProjectQuestionnaireSnapshotService, useValue: snapshotService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => {
          throw new UnauthorizedException('User not authenticated')
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .compile()

    app = moduleRef.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    await app.init()

    await request(app.getHttpServer())
      .post('/survey/project-questionnaire-snapshot')
      .send({
        projectId: PROJECT_ID,
      })
      .expect(401)
  })

  it('should return 403 for non-member snapshot requests', async () => {
    snapshotService = {
      createSnapshot: jest.fn(),
      getSnapshot: jest.fn(),
    }
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [SurveyController],
      providers: [
        { provide: SurveyService, useValue: {} },
        { provide: MaturityAnalysisService, useValue: {} },
        { provide: ActionPlanGenerationService, useValue: {} },
        { provide: ActionPlanService, useValue: {} },
        { provide: BinaryGapAnalyzer, useValue: {} },
        { provide: ProjectQuestionnaireSnapshotService, useValue: snapshotService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.user = { id: USER_ID, userId: USER_ID }
          return true
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.tenantId = TENANT_ID
          return true
        },
      })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => false })
      .compile()

    app = moduleRef.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    await app.init()

    await request(app.getHttpServer())
      .post('/survey/project-questionnaire-snapshot')
      .send({
        projectId: PROJECT_ID,
      })
      .expect(403)
  })
})
