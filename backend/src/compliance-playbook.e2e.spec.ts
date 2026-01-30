import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { getQueueToken } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import * as request from 'supertest'
import { AppModule } from './app.module'
import { CompliancePlaybookService } from './modules/radar/services/compliance-playbook.service'
import { CompliancePlaybook } from './database/entities/compliance-playbook.entity'
import { ComplianceChecklistSubmission } from './database/entities/compliance-checklist-submission.entity'
import { RadarPush } from './database/entities/radar-push.entity'
import { AnalyzedContent } from './database/entities/analyzed-content.entity'
import { RawContent } from './database/entities/raw-content.entity'

/**
 * Compliance Playbook E2E Tests (Story 4.2 - Phase 6.1)
 *
 * 端到端集成测试：CompliancePlaybookController + Service + Database
 */
describe('CompliancePlaybook E2E (Phase 6.1)', () => {
  let app: INestApplication
  let playbookService: CompliancePlaybookService
  let playbookRepo: Repository<CompliancePlaybook>
  let submissionRepo: Repository<ComplianceChecklistSubmission>
  let pushRepo: Repository<RadarPush>

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        TypeOrmModule.forFeature([
          CompliancePlaybook,
          ComplianceChecklistSubmission,
          RadarPush,
          AnalyzedContent,
          RawContent,
        ]),
      ],
    })
      .overrideProvider(getQueueToken('radar-push'))
      .useValue({
        add: jest.fn(),
        bulkAdd: jest.fn(),
      })
      .overrideProvider(getQueueToken('radar-playbook-generation'))
      .useValue({
        add: jest.fn(),
        bulkAdd: jest.fn(),
      })
      .compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    playbookService = app.get<CompliancePlaybookService>(CompliancePlaybookService)
    playbookRepo = app.get<Repository<CompliancePlaybook>>(
      'CompliancePlaybookRepository',
    )
    submissionRepo = app.get<Repository<ComplianceChecklistSubmission>>(
      'ComplianceChecklistSubmissionRepository',
    )
    pushRepo = app.get<Repository<RadarPush>>('RadarPushRepository')
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    // Clean up database before each test
    await submissionRepo.delete({})
    await playbookRepo.delete({})
    await pushRepo.delete({})
  })

  describe('GET /radar/compliance/playbooks/:pushId - E2E', () => {
    it('should return playbook when exists', async () => {
      // Arrange
      const push = await pushRepo.save({
        id: 'push-123',
        organizationId: 'org-123',
        radarType: 'compliance',
        contentId: 'content-123',
        status: 'sent',
        playbookStatus: 'ready',
      } as RadarPush)

      const playbook = await playbookRepo.save({
        id: 'playbook-123',
        pushId: push.id,
        organizationId: 'org-123', // AR12 Layer 3: 设置组织ID
        checklistItems: [
          {
            id: 'item-1',
            text: '检查数据安全制度',
            category: '数据安全',
            checked: false,
            order: 1,
          },
        ],
        solutions: [],
        reportTemplate: '合规自查报告',
        policyReference: [],
        generatedAt: new Date(),
      } as CompliancePlaybook)

      // Act
      const response = await request(app.getHttpServer())
        .get(`/radar/compliance/playbooks/${push.id}`)
        .expect(200)

      // Assert
      expect(response.body).toMatchObject({
        id: playbook.id,
        pushId: push.id,
      })
    })

    it('should return 202 when playbook is generating', async () => {
      // Arrange
      const push = await pushRepo.save({
        id: 'push-123',
        organizationId: 'org-123',
        radarType: 'compliance',
        contentId: 'content-123',
        status: 'sent',
        playbookStatus: 'generating',
      } as RadarPush)

      // Act
      const response = await request(app.getHttpServer())
        .get(`/radar/compliance/playbooks/${push.id}`)
        .expect(202)

      // Assert
      expect(response.body.message).toContain('Playbook is being generated')
    })

    it('should return 404 when playbook does not exist', async () => {
      // Arrange
      await pushRepo.save({
        id: 'push-123',
        organizationId: 'org-123',
        radarType: 'compliance',
        contentId: 'content-123',
        status: 'sent',
        playbookStatus: 'failed',
      } as RadarPush)

      // Act
      await request(app.getHttpServer())
        .get(`/radar/compliance/playbooks/non-existent-push`)
        .expect(404)
    })
  })

  describe('POST /radar/compliance/playbooks/:pushId/checklist - E2E', () => {
    it('should create new submission', async () => {
      // Arrange
      const push = await pushRepo.save({
        id: 'push-123',
        organizationId: 'org-123',
        radarType: 'compliance',
        contentId: 'content-123',
        status: 'sent',
        playbookStatus: 'ready',
      } as RadarPush)

      await playbookRepo.save({
        id: 'playbook-123',
        pushId: push.id,
        organizationId: 'org-123', // AR12 Layer 3: 设置组织ID
        checklistItems: [
          { id: 'item-1', text: '检查1', category: '数据安全', checked: false, order: 1 },
          { id: 'item-2', text: '检查2', category: '数据安全', checked: false, order: 2 },
        ],
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
        generatedAt: new Date(),
      } as CompliancePlaybook)

      const submitDto = {
        checkedItems: ['item-1'],
        uncheckedItems: ['item-2'],
        notes: 'Test notes',
      }

      // Act
      const response = await request(app.getHttpServer())
        .post(`/radar/compliance/playbooks/${push.id}/checklist`)
        .send(submitDto)
        .expect(201)

      // Assert
      expect(response.body).toMatchObject({
        message: 'Checklist submitted successfully',
        submission: {
          pushId: push.id,
          userId: 'user-123',
          checkedItems: ['item-1'],
          uncheckedItems: ['item-2'],
        },
      })
    })

    it('should update existing submission', async () => {
      // Arrange
      const push = await pushRepo.save({
        id: 'push-123',
        organizationId: 'org-123',
        radarType: 'compliance',
        contentId: 'content-123',
        status: 'sent',
        playbookStatus: 'ready',
      } as RadarPush)

      await playbookRepo.save({
        id: 'playbook-123',
        pushId: push.id,
        organizationId: 'org-123', // AR12 Layer 3: 设置组织ID
        checklistItems: [
          { id: 'item-1', text: '检查1', category: '数据安全', checked: false, order: 1 },
          { id: 'item-2', text: '检查2', category: '数据安全', checked: false, order: 2 },
        ],
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
        generatedAt: new Date(),
      } as CompliancePlaybook)

      // First submission
      await submissionRepo.save({
        id: 'submission-123',
        pushId: push.id,
        userId: 'user-123',
        checkedItems: ['item-1'],
        uncheckedItems: ['item-2'],
        submittedAt: new Date(),
        updatedAt: new Date(),
      } as ComplianceChecklistSubmission)

      const submitDto = {
        checkedItems: ['item-1', 'item-2'],
        uncheckedItems: [],
        notes: 'Updated notes',
      }

      // Act
      const response = await request(app.getHttpServer())
        .post(`/radar/compliance/playbooks/${push.id}/checklist`)
        .send(submitDto)
        .expect(201)

      // Assert
      expect(response.body.submission.checkedItems).toEqual(['item-1', 'item-2'])
    })

    it('should return 400 for duplicate item IDs', async () => {
      // Arrange
      const push = await pushRepo.save({
        id: 'push-123',
        organizationId: 'org-123',
        radarType: 'compliance',
        contentId: 'content-123',
        status: 'sent',
        playbookStatus: 'ready',
      } as RadarPush)

      await playbookRepo.save({
        id: 'playbook-123',
        pushId: push.id,
        organizationId: 'org-123', // AR12 Layer 3: 设置组织ID
        checklistItems: [
          { id: 'item-1', text: '检查1', category: '数据安全', checked: false, order: 1 },
          { id: 'item-2', text: '检查2', category: '数据安全', checked: false, order: 2 },
        ],
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
        generatedAt: new Date(),
      } as CompliancePlaybook)

      const submitDto = {
        checkedItems: ['item-1', 'item-2'],
        uncheckedItems: ['item-2'], // duplicate
        notes: 'Test',
      }

      // Act
      const response = await request(app.getHttpServer())
        .post(`/radar/compliance/playbooks/${push.id}/checklist`)
        .send(submitDto)
        .expect(400)

      // Assert
      expect(response.body.message).toContain('Duplicate')
    })

    it('should update checklistCompletedAt when all items checked', async () => {
      // Arrange
      const push = await pushRepo.save({
        id: 'push-123',
        organizationId: 'org-123',
        radarType: 'compliance',
        contentId: 'content-123',
        status: 'sent',
        playbookStatus: 'ready',
        checklistCompletedAt: null,
      } as RadarPush)

      await playbookRepo.save({
        id: 'playbook-123',
        pushId: push.id,
        organizationId: 'org-123', // AR12 Layer 3: 设置组织ID
        checklistItems: [
          { id: 'item-1', text: '检查1', category: '数据安全', checked: false, order: 1 },
          { id: 'item-2', text: '检查2', category: '数据安全', checked: false, order: 2 },
        ],
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
        generatedAt: new Date(),
      } as CompliancePlaybook)

      const submitDto = {
        checkedItems: ['item-1', 'item-2'],
        uncheckedItems: [],
      }

      // Act
      await request(app.getHttpServer())
        .post(`/radar/compliance/playbooks/${push.id}/checklist`)
        .send(submitDto)
        .expect(201)

      // Assert
      const updatedPush = await pushRepo.findOne({ where: { id: push.id } })
      expect(updatedPush?.checklistCompletedAt).toBeDefined()
    })
  })

  describe('GET /radar/compliance/playbooks/:pushId/checklist - E2E', () => {
    it('should return existing submission', async () => {
      // Arrange
      const push = await pushRepo.save({
        id: 'push-123',
        organizationId: 'org-123',
        radarType: 'compliance',
        contentId: 'content-123',
        status: 'sent',
        playbookStatus: 'ready',
      } as RadarPush)

      await submissionRepo.save({
        id: 'submission-123',
        pushId: push.id,
        userId: 'user-123',
        checkedItems: ['item-1'],
        uncheckedItems: ['item-2'],
        submittedAt: new Date(),
        updatedAt: new Date(),
      } as ComplianceChecklistSubmission)

      // Act
      const response = await request(app.getHttpServer())
        .get(`/radar/compliance/playbooks/${push.id}/checklist`)
        .expect(200)

      // Assert
      expect(response.body).toMatchObject({
        id: 'submission-123',
        pushId: push.id,
      })
    })

    it('should return null when submission does not exist', async () => {
      // Arrange
      const push = await pushRepo.save({
        id: 'push-123',
        organizationId: 'org-123',
        radarType: 'compliance',
        contentId: 'content-123',
        status: 'sent',
        playbookStatus: 'ready',
      } as RadarPush)

      // Act
      const response = await request(app.getHttpServer())
        .get(`/radar/compliance/playbooks/${push.id}/checklist`)
        .expect(200)

      // Assert
      expect(response.body).toBeNull()
    })
  })
})
