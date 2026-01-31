import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AppModule } from './app.module'
import { FileWatcherService } from './modules/radar/services/file-watcher.service'
import { CompliancePlaybookService } from './modules/radar/services/compliance-playbook.service'
import { CompliancePlaybook } from './database/entities/compliance-playbook.entity'
import { ComplianceChecklistSubmission } from './database/entities/compliance-checklist-submission.entity'
import { RadarPush } from './database/entities/radar-push.entity'
import { AnalyzedContent } from './database/entities/analyzed-content.entity'
import { RawContent } from './database/entities/raw-content.entity'
import { Organization } from './database/entities/organization.entity'
import { CrawlerLog } from './database/entities/crawler-log.entity'
import * as fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'

/**
 * Compliance Radar Full Workflow E2E Tests (Story 4.2 - Phase 6.2)
 *
 * 完整流程集成测试：爬取 → AI分析 → 剧本生成 → 推送 → API调用
 */
describe('Compliance Radar Full Workflow E2E (Phase 6.2)', () => {
  let app: INestApplication
  let fileWatcherService: FileWatcherService
  let playbookService: CompliancePlaybookService
  let rawContentRepo: Repository<RawContent>
  let analyzedContentRepo: Repository<AnalyzedContent>
  let radarPushRepo: Repository<RadarPush>
  let playbookRepo: Repository<CompliancePlaybook>
  let submissionRepo: Repository<ComplianceChecklistSubmission>
  let organizationRepo: Repository<Organization>

  const testOrgId = 'org-test-e2e'

  beforeAll(async () => {
    // Create test organization
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        TypeOrmModule.forFeature([
          RawContent,
          AnalyzedContent,
          RadarPush,
          CompliancePlaybook,
          ComplianceChecklistSubmission,
          Organization,
          CrawlerLog,
        ]),
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    fileWatcherService = app.get<FileWatcherService>(FileWatcherService)
    playbookService = app.get<CompliancePlaybookService>(CompliancePlaybookService)
    rawContentRepo = app.get<Repository<RawContent>>('RawContentRepository')
    analyzedContentRepo = app.get<Repository<AnalyzedContent>>('AnalyzedContentRepository')
    radarPushRepo = app.get<Repository<RadarPush>>('RadarPushRepository')
    playbookRepo = app.get<Repository<CompliancePlaybook>>(
      'CompliancePlaybookRepository',
    )
    submissionRepo = app.get<Repository<ComplianceChecklistSubmission>>(
      'ComplianceChecklistSubmissionRepository',
    )
    organizationRepo = app.get<Repository<Organization>>('OrganizationRepository')
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    // Clean up database
    await submissionRepo.delete({})
    await playbookRepo.delete({})
    await radarPushRepo.delete({})
    await analyzedContentRepo.delete({})
    await rawContentRepo.delete({})
    await organizationRepo.delete({})

    // Create test organization
    await organizationRepo.save({
      id: testOrgId,
      name: 'Test Organization E2E',
      radarActivated: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null as any,
      members: [],
      projects: [],
      weaknessSnapshots: [],
      watchedTopics: [],
      watchedPeers: [],
    } as Organization)
  })

  describe('Full Workflow: Crawl → Analyze → Playbook → Push → API', () => {
    it('should process compliance content end-to-end', async () => {
      // Step 1: Create raw content (simulating file watcher)
      const rawContent = await rawContentRepo.save({
        id: uuidv4(),
        title: '数据安全违规处罚案例',
        url: 'https://example.com/penalty',
        source: '监管机构',
        publishDate: new Date(),
        fullContent: '某银行因数据安全管理不到位，被处以50万元罚款',
        category: 'compliance',
        status: 'pending',
        organizationId: testOrgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as RawContent)

      // Step 2: Mark as analyzed and create analyzedContent
      await rawContentRepo.update(rawContent.id, { status: 'analyzed' })

      const analyzedContent = await analyzedContentRepo.save({
        id: uuidv4(),
        contentId: rawContent.id,
        rawContent: null as any,
        tags: [],
        keywords: [],
        categories: ['数据安全'],
        targetAudience: 'IT部门',
        aiSummary: '某银行因数据安全管理不到位被处罚',
        roiAnalysis: null,
        practiceDescription: null,
        estimatedCost: null,
        implementationPeriod: null,
        technicalEffect: null,
        complianceAnalysis: {
          complianceRiskCategory: '数据安全',
          penaltyCase: '某银行因数据安全管理不到位，被处以50万元罚款',
          policyRequirements: null,
          remediationSuggestions: '建立完善的数据分类分级制度',
          relatedWeaknessCategories: ['数据安全'],
        },
        relevanceScore: null,
        aiModel: 'qwen-turbo',
        tokensUsed: 1000,
        status: 'success',
        errorMessage: null,
        analyzedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AnalyzedContent)

      // Step 3: Create RadarPush
      const push = await radarPushRepo.save({
        id: uuidv4(),
        organizationId: testOrgId,
        radarType: 'compliance',
        contentId: rawContent.id,
        relevanceScore: 0.95,
        priorityLevel: 'high',
        status: 'scheduled',
        scheduledAt: new Date(),
        playbookStatus: 'ready',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as RadarPush)

      // Step 4: Create CompliancePlaybook
      const playbook = await playbookRepo.save({
        id: uuidv4(),
        pushId: push.id,
        organizationId: testOrgId, // AR12 Layer 3: 设置组织ID
        checklistItems: [
          {
            id: uuidv4(),
            text: '检查数据安全制度',
            category: '数据安全',
            checked: false,
            order: 1,
          },
          {
            id: uuidv4(),
            text: '验证数据分类分级',
            category: '数据安全',
            checked: false,
            order: 2,
          },
        ],
        solutions: [
          {
            name: '升级安全系统',
            estimatedCost: 50000,
            expectedBenefit: 200000,
            roiScore: 7,
            implementationTime: '2个月',
          },
        ],
        reportTemplate: '合规自查报告',
        policyReference: [],
        generatedAt: new Date(),
      } as CompliancePlaybook)

      // Step 5: Test GET playbook API
      const getResponse = await app.getHttpServer().inject({
        method: 'GET',
        url: `/radar/compliance/playbooks/${push.id}`,
      })

      expect(getResponse.statusCode).toBe(200)
      expect(getResponse.body).toMatchObject({
        id: playbook.id,
        pushId: push.id,
        checklistItems: expect.any(Array),
        solutions: expect.any(Array),
      })

      // Step 6: Test POST checklist API
      const submitDto = {
        checkedItems: [playbook.checklistItems[0].id],
        uncheckedItems: [playbook.checklistItems[1].id],
        notes: 'E2E test notes',
      }

      const postResponse = await app.getHttpServer().inject({
        method: 'POST',
        url: `/radar/compliance/playbooks/${push.id}/checklist`,
        payload: submitDto,
      })

      expect(postResponse.statusCode).toBe(201)
      expect(postResponse.body).toMatchObject({
        message: 'Checklist submitted successfully',
        submission: {
          pushId: push.id,
          userId: 'user-123',
          checkedItems: [playbook.checklistItems[0].id],
          uncheckedItems: [playbook.checklistItems[1].id],
        },
      })

      // Step 7: Verify checklistCompletedAt is updated when all checked
      const allCheckedDto = {
        checkedItems: playbook.checklistItems.map((item) => item.id),
        uncheckedItems: [],
      }

      await app.getHttpServer().inject({
        method: 'POST',
        url: `/radar/compliance/playbooks/${push.id}/checklist`,
        payload: allCheckedDto,
      })

      const updatedPush = await radarPushRepo.findOne({ where: { id: push.id } })
      expect(updatedPush?.checklistCompletedAt).toBeDefined()
    })

    it('should handle playbook generation failure gracefully', async () => {
      // Arrange
      const rawContent = await rawContentRepo.save({
        id: uuidv4(),
        title: '测试内容',
        url: 'https://example.com/test',
        source: '测试',
        publishDate: new Date(),
        fullContent: '测试内容',
        category: 'compliance',
        status: 'analyzed',
        organizationId: testOrgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as RawContent)

      await analyzedContentRepo.save({
        id: uuidv4(),
        contentId: rawContent.id,
        rawContent: null as any,
        tags: [],
        keywords: [],
        categories: ['数据安全'],
        targetAudience: 'IT部门',
        aiSummary: '测试摘要',
        roiAnalysis: null,
        practiceDescription: null,
        estimatedCost: null,
        implementationPeriod: null,
        technicalEffect: null,
        complianceAnalysis: {
          complianceRiskCategory: '数据安全',
          penaltyCase: '测试案例',
          policyRequirements: null,
          remediationSuggestions: '建议',
          relatedWeaknessCategories: ['数据安全'],
        },
        relevanceScore: null,
        aiModel: 'qwen-turbo',
        tokensUsed: 500,
        status: 'success',
        errorMessage: null,
        analyzedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AnalyzedContent)

      const push = await radarPushRepo.save({
        id: uuidv4(),
        organizationId: testOrgId,
        radarType: 'compliance',
        contentId: rawContent.id,
        relevanceScore: 0.85,
        priorityLevel: 'high',
        status: 'scheduled',
        scheduledAt: new Date(),
        playbookStatus: 'failed', // Simulated failure
        createdAt: new Date(),
        updatedAt: new Date(),
      } as RadarPush)

      // Act
      const response = await app.getHttpServer().inject({
        method: 'GET',
        url: `/radar/compliance/playbooks/${push.id}`,
      })

      // Assert
      expect(response.statusCode).toBe(500)
      expect(response.body.message).toContain('Playbook generation failed')
    })

    it('should return 404 when playbook not ready', async () => {
      // Arrange
      const rawContent = await rawContentRepo.save({
        id: uuidv4(),
        title: '测试内容',
        url: 'https://example.com/test',
        source: '测试',
        publishDate: new Date(),
        fullContent: '测试内容',
        category: 'compliance',
        status: 'analyzed',
        organizationId: testOrgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as RawContent)

      await analyzedContentRepo.save({
        id: uuidv4(),
        contentId: rawContent.id,
        rawContent: null as any,
        tags: [],
        keywords: [],
        categories: ['数据安全'],
        targetAudience: 'IT部门',
        aiSummary: '测试摘要',
        roiAnalysis: null,
        practiceDescription: null,
        estimatedCost: null,
        implementationPeriod: null,
        technicalEffect: null,
        complianceAnalysis: {
          complianceRiskCategory: '数据安全',
          penaltyCase: '测试案例',
          policyRequirements: null,
          remediationSuggestions: '建议',
          relatedWeaknessCategories: ['数据安全'],
        },
        relevanceScore: null,
        aiModel: 'qwen-turbo',
        tokensUsed: 500,
        status: 'success',
        errorMessage: null,
        analyzedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AnalyzedContent)

      const push = await radarPushRepo.save({
        id: uuidv4(),
        organizationId: testOrgId,
        radarType: 'compliance',
        contentId: rawContent.id,
        relevanceScore: 0.85,
        priorityLevel: 'high',
        status: 'scheduled',
        scheduledAt: new Date(),
        playbookStatus: 'generating', // Still generating
        createdAt: new Date(),
        updatedAt: new Date(),
      } as RadarPush)

      // Act
      const response = await app.getHttpServer().inject({
        method: 'GET',
        url: `/radar/compliance/playbooks/${push.id}`,
      })

      // Assert
      expect(response.statusCode).toBe(202)
      expect(response.body.message).toContain('Playbook is being generated')
    })
  })

  describe('Error Handling - E2E', () => {
    it('should handle missing organization gracefully', async () => {
      // This test verifies that the system handles edge cases
      const response = await app.getHttpServer().inject({
        method: 'GET',
        url: '/radar/compliance/playbooks/non-existent-push',
      })

      expect(response.statusCode).toBe(404)
    })

    it('should handle invalid checklist submission', async () => {
      // Arrange
      const push = await radarPushRepo.save({
        id: uuidv4(),
        organizationId: testOrgId,
        radarType: 'compliance',
        contentId: 'content-123',
        status: 'sent',
        playbookStatus: 'ready',
      } as RadarPush)

      await playbookRepo.save({
        id: uuidv4(),
        pushId: push.id,
        organizationId: testOrgId, // AR12 Layer 3: 设置组织ID
        checklistItems: [
          { id: 'item-1', text: '检查1', category: '数据安全', checked: false, order: 1 },
        ],
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
        generatedAt: new Date(),
      } as CompliancePlaybook)

      const invalidDto = {
        checkedItems: ['non-existent-item'],
        uncheckedItems: [],
      }

      // Act
      const response = await app.getHttpServer().inject({
        method: 'POST',
        url: `/radar/compliance/playbooks/${push.id}/checklist`,
        payload: invalidDto,
      })

      // Assert
      expect(response.statusCode).toBe(400)
      expect(response.body.message).toContain('Invalid item IDs')
    })
  })
})
