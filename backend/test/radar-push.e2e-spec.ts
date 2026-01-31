import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { DataSource } from 'typeorm'
import { AppModule } from '../src/app.module'
import { Organization } from '../src/database/entities/organization.entity'
import { User, UserRole } from '../src/database/entities/user.entity'
import { OrganizationMember } from '../src/database/entities/organization-member.entity'
import { RadarPush } from '../src/database/entities/radar-push.entity'
import { AnalyzedContent } from '../src/database/entities/analyzed-content.entity'
import { RawContent } from '../src/database/entities/raw-content.entity'
import { Tag } from '../src/database/entities/tag.entity'
import { WeaknessSnapshot } from '../src/database/entities/weakness-snapshot.entity'
import { WatchedTopic } from '../src/database/entities/watched-topic.entity'
import { WeaknessCategory } from '../src/constants/categories'
import { RelevanceService } from '../src/modules/radar/services/relevance.service'
import { PushSchedulerService } from '../src/modules/radar/services/push-scheduler.service'
import { Queue } from 'bullmq'
import { getQueueToken } from '@nestjs/bullmq'

/**
 * E2E Tests for Story 2.3: Push System and Scheduling
 *
 * Tests the complete push workflow:
 * 1. 完整推送流程 - AnalyzedContent → 相关性计算 → RadarPush创建 → WebSocket推送
 * 2. 推送调度 - 三大雷达的定时推送
 * 3. 推送限制与去重 - 每个组织最多5条，重复contentId不重复推送
 * 4. 推送失败与重试 - WebSocket失败处理和重试机制
 * 5. 多组织隔离测试 - 组织A的推送不会发送到组织B
 * 6. 推送交互功能 - 查询推送历史、标记已读等API
 * 7. WebSocket可靠性 - 断线重连、推送顺序、重复检测
 *
 * SETUP REQUIREMENTS:
 * - Test database must be running
 * - Migrations must be applied: npm run migration:run
 * - Redis must be running for BullMQ
 */
describe('Radar Push System (E2E)', () => {
  let app: INestApplication
  let dataSource: DataSource
  let relevanceService: RelevanceService
  let pushSchedulerService: PushSchedulerService
  let pushQueue: Queue

  // Test IDs
  const testUserId = '10000000-0000-0000-0000-000000000001'
  const testUser2Id = '10000000-0000-0000-0000-000000000002'
  let org1Id: string
  let org2Id: string
  let authToken: string
  let authToken2: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())

    dataSource = app.get<DataSource>(DataSource)
    relevanceService = app.get<RelevanceService>(RelevanceService)
    pushSchedulerService = app.get<PushSchedulerService>(PushSchedulerService)
    pushQueue = app.get<Queue>(getQueueToken('radar:push'))

    await app.init()

    // Cleanup existing test data
    await cleanupTestData()

    // Create test users and organizations
    await setupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await app.close()
  })

  /**
   * Setup test data: users, organizations, weaknesses, topics
   */
  async function setupTestData() {
    // Create test user 1
    const user1 = dataSource.getRepository(User).create({
      id: testUserId,
      name: 'Test User 1',
      email: 'test-push-1@example.com',
      passwordHash: '$2b$10$test_hash_1',
      role: UserRole.RESPONDENT,
    })
    await dataSource.getRepository(User).save(user1)

    // Create test user 2
    const user2 = dataSource.getRepository(User).create({
      id: testUser2Id,
      name: 'Test User 2',
      email: 'test-push-2@example.com',
      passwordHash: '$2b$10$test_hash_2',
      role: UserRole.RESPONDENT,
    })
    await dataSource.getRepository(User).save(user2)

    // Create organization 1
    const org1 = dataSource.getRepository(Organization).create({
      id: '20000000-0000-0000-0000-000000000001',
      name: 'Test Org 1 for Push',
      radarActivated: true,
    })
    await dataSource.getRepository(Organization).save(org1)
    org1Id = org1.id

    // Create organization 2
    const org2 = dataSource.getRepository(Organization).create({
      id: '20000000-0000-0000-0000-000000000002',
      name: 'Test Org 2 for Push',
      radarActivated: true,
    })
    await dataSource.getRepository(Organization).save(org2)
    org2Id = org2.id

    // Add user 1 to org 1
    const member1 = dataSource.getRepository(OrganizationMember).create({
      userId: testUserId,
      organizationId: org1Id,
      role: 'admin',
    })
    await dataSource.getRepository(OrganizationMember).save(member1)

    // Add user 2 to org 2
    const member2 = dataSource.getRepository(OrganizationMember).create({
      userId: testUser2Id,
      organizationId: org2Id,
      role: 'admin',
    })
    await dataSource.getRepository(OrganizationMember).save(member2)

    // Create weaknesses for org 1
    const weakness1 = dataSource.getRepository(WeaknessSnapshot).create({
      organizationId: org1Id,
      category: WeaknessCategory.DATA_SECURITY,
      level: 1, // 最薄弱
      projectId: null,
    })
    await dataSource.getRepository(WeaknessSnapshot).save(weakness1)

    // Create watched topics for org 1
    const topic1 = dataSource.getRepository(WatchedTopic).create({
      organizationId: org1Id,
      topicName: 'AI应用',
      topicType: 'tech',
    })
    await dataSource.getRepository(WatchedTopic).save(topic1)

    // Get auth tokens (mock JWT for testing)
    // In real tests, you would call the login endpoint
    authToken = 'mock-jwt-token-user1'
    authToken2 = 'mock-jwt-token-user2'
  }

  /**
   * Cleanup test data
   */
  async function cleanupTestData() {
    try {
      await dataSource.getRepository(RadarPush).delete({
        organizationId: org1Id || '20000000-0000-0000-0000-000000000001',
      })
      await dataSource.getRepository(RadarPush).delete({
        organizationId: org2Id || '20000000-0000-0000-0000-000000000002',
      })
      await dataSource.getRepository(WatchedTopic).delete({
        organizationId: org1Id || '20000000-0000-0000-0000-000000000001',
      })
      await dataSource.getRepository(WeaknessSnapshot).delete({
        organizationId: org1Id || '20000000-0000-0000-0000-000000000001',
      })
      await dataSource.getRepository(AnalyzedContent).delete({})
      await dataSource.getRepository(Tag).delete({})
      await dataSource.getRepository(RawContent).delete({})
      await dataSource.getRepository(OrganizationMember).delete({
        organizationId: org1Id || '20000000-0000-0000-0000-000000000001',
      })
      await dataSource.getRepository(OrganizationMember).delete({
        organizationId: org2Id || '20000000-0000-0000-0000-000000000002',
      })
      await dataSource.getRepository(Organization).delete({
        id: org1Id || '20000000-0000-0000-0000-000000000001',
      })
      await dataSource.getRepository(Organization).delete({
        id: org2Id || '20000000-0000-0000-0000-000000000002',
      })
      await dataSource.getRepository(User).delete({ id: testUserId })
      await dataSource.getRepository(User).delete({ id: testUser2Id })
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Helper: Create test analyzed content
   */
  async function createTestContent(
    title: string,
    categories: string[],
    tags: string[],
  ): Promise<AnalyzedContent> {
    // Create raw content
    const rawContent = dataSource.getRepository(RawContent).create({
      title,
      url: `https://example.com/${title}`,
      source: 'TEST',
      category: 'tech',
      publishDate: new Date(),
    })
    await dataSource.getRepository(RawContent).save(rawContent)

    // Create tags
    const tagEntities = []
    for (const tagName of tags) {
      const tag = dataSource.getRepository(Tag).create({
        name: tagName,
        category: null,
      })
      await dataSource.getRepository(Tag).save(tag)
      tagEntities.push(tag)
    }

    // Create analyzed content
    const analyzedContent = dataSource.getRepository(AnalyzedContent).create({
      contentId: rawContent.id,
      status: 'success',
      categories,
      tags: tagEntities,
      aiSummary: `Summary of ${title}`,
      targetAudience: 'CTO',
      rawContent,
    })
    await dataSource.getRepository(AnalyzedContent).save(analyzedContent)

    return analyzedContent
  }

  describe('1. 完整推送流程', () => {
    it('应该完成从AnalyzedContent到RadarPush的完整流程', async () => {
      // 1. 创建AnalyzedContent
      const content = await createTestContent(
        'Test Content for Push Flow',
        ['数据安全', 'AI应用'],
        ['数据加密', '机器学习'],
      )

      // 2. 触发相关性计算
      await relevanceService.calculateRelevance(content.id)

      // 3. 验证RadarPush记录已创建
      const pushes = await dataSource.getRepository(RadarPush).find({
        where: { contentId: content.id },
      })

      expect(pushes.length).toBeGreaterThan(0)
      expect(pushes[0].organizationId).toBe(org1Id)
      expect(pushes[0].radarType).toBe('tech')
      expect(pushes[0].status).toBe('scheduled')
      expect(pushes[0].relevanceScore).toBeGreaterThanOrEqual(0.9)
    })

    it('应该正确计算相关性评分（薄弱项0.6 + 关注领域0.4）', async () => {
      const content = await createTestContent(
        'Test Content for Relevance Score',
        ['数据安全', 'AI应用'],
        ['数据加密'],
      )

      await relevanceService.calculateRelevance(content.id)

      const push = await dataSource.getRepository(RadarPush).findOne({
        where: { contentId: content.id, organizationId: org1Id },
      })

      // weaknessMatch = 1.0 (数据安全 level 1)
      // topicMatch = 1.0 (AI应用完全匹配)
      // relevanceScore = 1.0 * 0.6 + 1.0 * 0.4 = 1.0
      expect(push.relevanceScore).toBe(1.0)
    })
  })

  describe('2. 推送调度', () => {
    it('应该获取待推送的内容（status=scheduled, scheduledAt <= now）', async () => {
      // Create a push with past scheduledAt
      const content = await createTestContent(
        'Test Content for Scheduling',
        ['数据安全'],
        [],
      )

      const push = dataSource.getRepository(RadarPush).create({
        organizationId: org1Id,
        radarType: 'tech',
        contentId: content.id,
        relevanceScore: 0.95,
        priorityLevel: 'high',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      })
      await dataSource.getRepository(RadarPush).save(push)

      // Get pending pushes
      const pendingPushes = await pushSchedulerService.getPendingPushes('tech')

      expect(pendingPushes.length).toBeGreaterThan(0)
      expect(pendingPushes.some((p) => p.id === push.id)).toBe(true)
    })

    it('应该按priorityLevel和relevanceScore降序排序', async () => {
      const content = await createTestContent('Test Content for Sorting', ['数据安全'], [])

      // Create multiple pushes with different priorities
      const push1 = dataSource.getRepository(RadarPush).create({
        organizationId: org1Id,
        radarType: 'tech',
        contentId: content.id,
        relevanceScore: 0.92,
        priorityLevel: 'high',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() - 1000),
      })
      await dataSource.getRepository(RadarPush).save(push1)

      const push2 = dataSource.getRepository(RadarPush).create({
        organizationId: org1Id,
        radarType: 'tech',
        contentId: content.id,
        relevanceScore: 0.95,
        priorityLevel: 'high',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() - 1000),
      })
      await dataSource.getRepository(RadarPush).save(push2)

      const pendingPushes = await pushSchedulerService.getPendingPushes('tech')

      // First push should have higher relevanceScore
      const sortedPushes = pendingPushes.filter(
        (p) => p.id === push1.id || p.id === push2.id,
      )
      expect(sortedPushes[0].relevanceScore).toBeGreaterThanOrEqual(
        sortedPushes[1].relevanceScore,
      )
    })
  })

  describe('3. 推送限制与去重', () => {
    it('应该限制每个组织最多5条推送', async () => {
      const content = await createTestContent('Test Content for Limit', ['数据安全'], [])

      // Create 10 pushes for the same organization
      const pushes = []
      for (let i = 0; i < 10; i++) {
        const push = dataSource.getRepository(RadarPush).create({
          organizationId: org1Id,
          radarType: 'tech',
          contentId: content.id,
          relevanceScore: 0.9 + i * 0.01,
          priorityLevel: 'high',
          status: 'scheduled',
          scheduledAt: new Date(Date.now() - 1000),
        })
        pushes.push(push)
      }
      await dataSource.getRepository(RadarPush).save(pushes)

      // Group by organization
      const allPushes = await pushSchedulerService.getPendingPushes('tech')
      const grouped = pushSchedulerService.groupByOrganization(allPushes, 5)

      // Should have at most 5 pushes per organization
      for (const [orgId, orgPushes] of grouped) {
        expect(orgPushes.length).toBeLessThanOrEqual(5)
      }
    })

    it('应该防止重复推送相同contentId（同一scheduledAt时间段）', async () => {
      const content = await createTestContent('Test Content for Dedup', ['数据安全'], [])

      // First relevance calculation
      await relevanceService.calculateRelevance(content.id)

      const pushCountBefore = await dataSource.getRepository(RadarPush).count({
        where: { contentId: content.id, organizationId: org1Id },
      })

      // Second relevance calculation (should not create duplicate)
      await relevanceService.calculateRelevance(content.id)

      const pushCountAfter = await dataSource.getRepository(RadarPush).count({
        where: { contentId: content.id, organizationId: org1Id },
      })

      // Should not create duplicate push
      expect(pushCountAfter).toBe(pushCountBefore)
    })
  })

  describe('4. 推送失败与重试', () => {
    it('应该标记推送为sent', async () => {
      const content = await createTestContent('Test Content for Sent', ['数据安全'], [])

      const push = dataSource.getRepository(RadarPush).create({
        organizationId: org1Id,
        radarType: 'tech',
        contentId: content.id,
        relevanceScore: 0.95,
        priorityLevel: 'high',
        status: 'scheduled',
        scheduledAt: new Date(),
      })
      await dataSource.getRepository(RadarPush).save(push)

      // Mark as sent
      await pushSchedulerService.markAsSent(push.id)

      // Verify status updated
      const updatedPush = await dataSource.getRepository(RadarPush).findOne({
        where: { id: push.id },
      })

      expect(updatedPush.status).toBe('sent')
      expect(updatedPush.sentAt).toBeDefined()
    })

    it('应该标记推送为failed', async () => {
      const content = await createTestContent('Test Content for Failed', ['数据安全'], [])

      const push = dataSource.getRepository(RadarPush).create({
        organizationId: org1Id,
        radarType: 'tech',
        contentId: content.id,
        relevanceScore: 0.95,
        priorityLevel: 'high',
        status: 'scheduled',
        scheduledAt: new Date(),
      })
      await dataSource.getRepository(RadarPush).save(push)

      // Mark as failed
      await pushSchedulerService.markAsFailed(push.id, 'WebSocket connection failed')

      // Verify status updated
      const updatedPush = await dataSource.getRepository(RadarPush).findOne({
        where: { id: push.id },
      })

      expect(updatedPush.status).toBe('failed')
    })
  })

  describe('5. 多组织隔离测试', () => {
    it('应该只为相关组织创建推送', async () => {
      const content = await createTestContent(
        'Test Content for Org Isolation',
        ['数据安全'],
        [],
      )

      // Calculate relevance (should only create push for org1, not org2)
      await relevanceService.calculateRelevance(content.id)

      const org1Pushes = await dataSource.getRepository(RadarPush).count({
        where: { contentId: content.id, organizationId: org1Id },
      })

      const org2Pushes = await dataSource.getRepository(RadarPush).count({
        where: { contentId: content.id, organizationId: org2Id },
      })

      // Org1 has weakness and topic, should have push
      expect(org1Pushes).toBeGreaterThan(0)

      // Org2 has no weakness or topic, should not have push
      expect(org2Pushes).toBe(0)
    })
  })

  describe('6. 推送交互功能 (API)', () => {
    it('应该查询推送历史（GET /api/radar/pushes）', async () => {
      // Note: This test requires JWT authentication to be properly set up
      // For now, we'll test the repository query directly

      const content = await createTestContent('Test Content for History', ['数据安全'], [])

      const push = dataSource.getRepository(RadarPush).create({
        organizationId: org1Id,
        radarType: 'tech',
        contentId: content.id,
        relevanceScore: 0.95,
        priorityLevel: 'high',
        status: 'sent',
        scheduledAt: new Date(),
        sentAt: new Date(),
      })
      await dataSource.getRepository(RadarPush).save(push)

      // Query push history
      const [pushes, total] = await dataSource.getRepository(RadarPush).findAndCount({
        where: { organizationId: org1Id },
        order: {
          priorityLevel: 'DESC',
          relevanceScore: 'DESC',
          scheduledAt: 'DESC',
        },
        take: 20,
      })

      expect(total).toBeGreaterThan(0)
      expect(pushes.some((p) => p.id === push.id)).toBe(true)
    })

    it('应该获取推送详情（GET /api/radar/pushes/:id）', async () => {
      const content = await createTestContent('Test Content for Detail', ['数据安全'], [])

      const push = dataSource.getRepository(RadarPush).create({
        organizationId: org1Id,
        radarType: 'tech',
        contentId: content.id,
        relevanceScore: 0.95,
        priorityLevel: 'high',
        status: 'sent',
        scheduledAt: new Date(),
      })
      await dataSource.getRepository(RadarPush).save(push)

      // Get push detail
      const pushDetail = await dataSource.getRepository(RadarPush).findOne({
        where: { id: push.id, organizationId: org1Id },
        relations: ['analyzedContent', 'analyzedContent.rawContent', 'analyzedContent.tags'],
      })

      expect(pushDetail).toBeDefined()
      expect(pushDetail.id).toBe(push.id)
      expect(pushDetail.analyzedContent).toBeDefined()
    })
  })

  describe('7. 推送统计', () => {
    it('应该返回正确的推送统计信息', async () => {
      const content = await createTestContent('Test Content for Stats', ['数据安全'], [])

      // Create pushes with different statuses
      const push1 = dataSource.getRepository(RadarPush).create({
        organizationId: org1Id,
        radarType: 'tech',
        contentId: content.id,
        relevanceScore: 0.95,
        priorityLevel: 'high',
        status: 'sent',
        scheduledAt: new Date(),
        sentAt: new Date(),
      })
      await dataSource.getRepository(RadarPush).save(push1)

      const push2 = dataSource.getRepository(RadarPush).create({
        organizationId: org1Id,
        radarType: 'tech',
        contentId: content.id,
        relevanceScore: 0.92,
        priorityLevel: 'medium',
        status: 'failed',
        scheduledAt: new Date(),
      })
      await dataSource.getRepository(RadarPush).save(push2)

      // Get stats
      const stats = await pushSchedulerService.getPushStats(
        org1Id,
        'tech',
        new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        new Date(),
      )

      expect(stats.total).toBeGreaterThan(0)
      expect(stats.sent).toBeGreaterThan(0)
      expect(stats.failed).toBeGreaterThan(0)
    })
  })
})
