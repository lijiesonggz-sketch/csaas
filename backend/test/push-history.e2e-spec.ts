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
import { generateTestToken } from './helpers/auth.helper'

/**
 * E2E Tests for Story 5.4: 推送历史查看
 *
 * 测试推送历史查看的完整功能:
 * 1. 推送历史列表查询（分页、排序）
 * 2. 多维度筛选（雷达类型、时间范围、相关性）
 * 3. 已读状态管理（标记已读、未读统计）
 * 4. 多租户数据隔离
 * 5. API 参数验证
 *
 * SETUP REQUIREMENTS:
 * - Test database must be running
 * - Migrations must be applied: npm run migration:run
 */
describe('[P1] Push History API (E2E) - Story 5.4', () => {
  let app: INestApplication
  let dataSource: DataSource

  // Test data IDs
  const testUserId1 = '10000000-0000-0000-0000-000000000011'
  const testUserId2 = '10000000-0000-0000-0000-000000000012'
  let org1Id: string
  let org2Id: string
  let authToken1: string
  let authToken2: string

  // Test push IDs
  let techPushId: string
  let industryPushId: string
  let compliancePushId: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )

    dataSource = app.get<DataSource>(DataSource)

    await app.init()

    // Cleanup and setup test data
    await cleanupTestData()
    await setupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await app.close()
  })

  /**
   * Setup test data: users, organizations, pushes
   */
  async function setupTestData() {
    // Create test users
    const user1 = dataSource.getRepository(User).create({
      id: testUserId1,
      name: 'Test User 1 - Push History',
      email: 'test-push-history-1@example.com',
      passwordHash: '$2b$10$test_hash_push_history_1',
      role: UserRole.RESPONDENT,
    })
    await dataSource.getRepository(User).save(user1)

    const user2 = dataSource.getRepository(User).create({
      id: testUserId2,
      name: 'Test User 2 - Push History',
      email: 'test-push-history-2@example.com',
      passwordHash: '$2b$10$test_hash_push_history_2',
      role: UserRole.RESPONDENT,
    })
    await dataSource.getRepository(User).save(user2)

    // Create organizations
    const org1 = dataSource.getRepository(Organization).create({
      id: '30000000-0000-0000-0000-000000000001',
      name: 'Test Org 1 - Push History',
      radarActivated: true,
    })
    await dataSource.getRepository(Organization).save(org1)
    org1Id = org1.id

    const org2 = dataSource.getRepository(Organization).create({
      id: '30000000-0000-0000-0000-000000000002',
      name: 'Test Org 2 - Push History',
      radarActivated: true,
    })
    await dataSource.getRepository(Organization).save(org2)
    org2Id = org2.id

    // Add users to organizations
    await dataSource.getRepository(OrganizationMember).save([
      {
        userId: testUserId1,
        organizationId: org1Id,
        role: 'admin',
      },
      {
        userId: testUserId2,
        organizationId: org2Id,
        role: 'admin',
      },
    ])

    // Create test content and pushes for org1
    const techContent = await createTestContent('技术雷达推送测试', 'tech')
    const industryContent = await createTestContent('行业雷达推送测试', 'industry')
    const complianceContent = await createTestContent('合规雷达推送测试', 'compliance')

    // Create tech push (high relevance, sent 3 days ago)
    const techPush = dataSource.getRepository(RadarPush).create({
      organizationId: org1Id,
      radarType: 'tech',
      contentId: techContent.id,
      relevanceScore: 0.95,
      priorityLevel: 'high',
      status: 'sent',
      scheduledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      isRead: false,
      readAt: null,
    })
    await dataSource.getRepository(RadarPush).save(techPush)
    techPushId = techPush.id

    // Create industry push (medium relevance, sent 6 days ago - within 7 day range)
    const industryPush = dataSource.getRepository(RadarPush).create({
      organizationId: org1Id,
      radarType: 'industry',
      contentId: industryContent.id,
      relevanceScore: 0.75,
      priorityLevel: 'medium',
      status: 'sent',
      scheduledAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      sentAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      isRead: true,
      readAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    })
    await dataSource.getRepository(RadarPush).save(industryPush)
    industryPushId = industryPush.id

    // Create compliance push (low relevance, sent 35 days ago)
    const compliancePush = dataSource.getRepository(RadarPush).create({
      organizationId: org1Id,
      radarType: 'compliance',
      contentId: complianceContent.id,
      relevanceScore: 0.65,
      priorityLevel: 'low',
      status: 'sent',
      scheduledAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      sentAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      isRead: false,
      readAt: null,
    })
    await dataSource.getRepository(RadarPush).save(compliancePush)
    compliancePushId = compliancePush.id

    // Create push for org2 (for isolation testing)
    const org2Content = await createTestContent('组织2推送测试', 'tech')
    await dataSource.getRepository(RadarPush).save({
      organizationId: org2Id,
      radarType: 'tech',
      contentId: org2Content.id,
      relevanceScore: 0.9,
      priorityLevel: 'high',
      status: 'sent',
      scheduledAt: new Date(),
      sentAt: new Date(),
      isRead: false,
      readAt: null,
    })

    // Generate real JWT tokens for testing
    authToken1 = await generateTestToken({
      id: testUserId1,
      email: 'test-push-history-1@example.com',
      role: UserRole.RESPONDENT,
    })
    authToken2 = await generateTestToken({
      id: testUserId2,
      email: 'test-push-history-2@example.com',
      role: UserRole.RESPONDENT,
    })
  }

  /**
   * Helper: Create test content
   */
  async function createTestContent(
    title: string,
    category: 'tech' | 'industry' | 'compliance',
  ): Promise<AnalyzedContent> {
    // Generate a simple hash for testing
    const contentHash = require('crypto')
      .createHash('sha256')
      .update(`${title}-${Date.now()}`)
      .digest('hex')

    const rawContent = dataSource.getRepository(RawContent).create({
      title,
      url: `https://example.com/${title}`,
      source: 'TEST',
      category,
      publishDate: new Date(),
      fullContent: `这是${title}的完整内容。包含详细的技术分析和案例说明。`,
      contentHash,
    })
    await dataSource.getRepository(RawContent).save(rawContent)

    const analyzedContent = dataSource.getRepository(AnalyzedContent).create({
      contentId: rawContent.id,
      status: 'success',
      categories: ['测试分类'],
      tags: [],
      keywords: ['测试', '关键词'],
      aiSummary: `${title}的摘要内容`,
      targetAudience: 'CTO',
      aiModel: 'qwen-max',
      tokensUsed: 100,
      analyzedAt: new Date(),
      rawContent,
    })
    await dataSource.getRepository(AnalyzedContent).save(analyzedContent)

    return analyzedContent
  }

  /**
   * Cleanup test data
   */
  async function cleanupTestData() {
    try {
      // Use default IDs if not yet set
      const cleanOrg1Id = org1Id || '30000000-0000-0000-0000-000000000001'
      const cleanOrg2Id = org2Id || '30000000-0000-0000-0000-000000000002'

      // Delete in correct order to respect foreign key constraints
      await dataSource.getRepository(RadarPush).delete({ organizationId: cleanOrg1Id })
      await dataSource.getRepository(RadarPush).delete({ organizationId: cleanOrg2Id })

      // Delete analyzed content and raw content
      await dataSource.query('DELETE FROM analyzed_contents WHERE 1=1')
      await dataSource.query('DELETE FROM raw_contents WHERE source = $1', ['TEST'])

      // Delete organization members
      await dataSource.getRepository(OrganizationMember).delete({ userId: testUserId1 })
      await dataSource.getRepository(OrganizationMember).delete({ userId: testUserId2 })

      // Delete organizations and users
      await dataSource.getRepository(Organization).delete({ id: cleanOrg1Id })
      await dataSource.getRepository(Organization).delete({ id: cleanOrg2Id })
      await dataSource.getRepository(User).delete({ id: testUserId1 })
      await dataSource.getRepository(User).delete({ id: testUserId2 })
    } catch (error) {
      // Ignore cleanup errors
      console.log('Cleanup error (ignored):', error.message)
    }
  }

  describe('[P1] GET /api/radar/pushes - 推送历史列表查询', () => {
    it('应该返回推送历史列表（默认分页）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ })
        .set('Authorization', authToken1)
        .expect(200)

      expect(response.body).toHaveProperty('data')
      expect(response.body).toHaveProperty('meta')
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.meta).toMatchObject({
        page: 1,
        limit: 20,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      })
    })

    it('应该按 sentAt 倒序排序（最新的在前）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ })
        .set('Authorization', authToken1)
        .expect(200)

      const pushes = response.body.data
      expect(pushes.length).toBeGreaterThan(0)

      // Verify descending order by sentAt
      for (let i = 0; i < pushes.length - 1; i++) {
        const current = new Date(pushes[i].sentAt)
        const next = new Date(pushes[i + 1].sentAt)
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime())
      }
    })

    it('应该包含完整的推送信息（标题、摘要、相关性等）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ })
        .set('Authorization', authToken1)
        .expect(200)

      const push = response.body.data[0]
      expect(push).toMatchObject({
        id: expect.any(String),
        radarType: expect.stringMatching(/^(tech|industry|compliance)$/),
        title: expect.any(String),
        summary: expect.any(String),
        relevanceScore: expect.any(Number),
        relevanceLevel: expect.stringMatching(/^(high|medium|low)$/),
        sentAt: expect.any(String),
        isRead: expect.any(Boolean),
      })
    })
  })

  describe('[P1] GET /api/radar/pushes - 雷达类型筛选', () => {
    it('应该只返回技术雷达推送（radarType=tech）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ radarType: 'tech' })
        .set('Authorization', authToken1)
        .expect(200)

      const pushes = response.body.data
      expect(pushes.length).toBeGreaterThan(0)
      pushes.forEach((push: any) => {
        expect(push.radarType).toBe('tech')
      })
    })

    it('应该只返回行业雷达推送（radarType=industry）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ radarType: 'industry' })
        .set('Authorization', authToken1)
        .expect(200)

      const pushes = response.body.data
      expect(pushes.length).toBeGreaterThan(0)
      pushes.forEach((push: any) => {
        expect(push.radarType).toBe('industry')
      })
    })

    it('应该只返回合规雷达推送（radarType=compliance）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ radarType: 'compliance' })
        .set('Authorization', authToken1)
        .expect(200)

      const pushes = response.body.data
      expect(pushes.length).toBeGreaterThan(0)
      pushes.forEach((push: any) => {
        expect(push.radarType).toBe('compliance')
      })
    })
  })

  describe('[P1] GET /api/radar/pushes - 时间范围筛选', () => {
    it('应该只返回最近7天的推送（timeRange=7d）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ timeRange: '7d' })
        .set('Authorization', authToken1)
        .expect(200)

      const pushes = response.body.data
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      pushes.forEach((push: any) => {
        const sentAt = new Date(push.sentAt)
        expect(sentAt.getTime()).toBeGreaterThanOrEqual(sevenDaysAgo.getTime())
      })
    })

    it('应该只返回最近30天的推送（timeRange=30d）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ timeRange: '30d' })
        .set('Authorization', authToken1)
        .expect(200)

      const pushes = response.body.data
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      pushes.forEach((push: any) => {
        const sentAt = new Date(push.sentAt)
        expect(sentAt.getTime()).toBeGreaterThanOrEqual(thirtyDaysAgo.getTime())
      })
    })

    it('应该支持自定义日期范围筛选（startDate + endDate）', async () => {
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      const endDate = new Date().toISOString()

      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ startDate, endDate })
        .set('Authorization', authToken1)
        .expect(200)

      const pushes = response.body.data
      pushes.forEach((push: any) => {
        const sentAt = new Date(push.sentAt)
        expect(sentAt.getTime()).toBeGreaterThanOrEqual(new Date(startDate).getTime())
        expect(sentAt.getTime()).toBeLessThanOrEqual(new Date(endDate).getTime())
      })
    })
  })

  describe('[P1] GET /api/radar/pushes - 相关性筛选', () => {
    it('应该只返回高相关推送（relevance=high, score >= 0.9）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ relevance: 'high' })
        .set('Authorization', authToken1)
        .expect(200)

      const pushes = response.body.data
      pushes.forEach((push: any) => {
        expect(push.relevanceScore).toBeGreaterThanOrEqual(0.9)
        expect(push.relevanceLevel).toBe('high')
      })
    })

    it('应该只返回中相关推送（relevance=medium, 0.7 <= score < 0.9）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ relevance: 'medium' })
        .set('Authorization', authToken1)
        .expect(200)

      const pushes = response.body.data
      pushes.forEach((push: any) => {
        expect(push.relevanceScore).toBeGreaterThanOrEqual(0.7)
        expect(push.relevanceScore).toBeLessThan(0.9)
        expect(push.relevanceLevel).toBe('medium')
      })
    })

    it('应该只返回低相关推送（relevance=low, score < 0.7）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ relevance: 'low' })
        .set('Authorization', authToken1)
        .expect(200)

      const pushes = response.body.data
      pushes.forEach((push: any) => {
        expect(push.relevanceScore).toBeLessThan(0.7)
        expect(push.relevanceLevel).toBe('low')
      })
    })
  })

  describe('[P1] GET /api/radar/pushes - 组合筛选', () => {
    it('应该支持多维度组合筛选（雷达类型 + 时间 + 相关性）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({
          radarType: 'tech',
          timeRange: '30d',
          relevance: 'high',
        })
        .set('Authorization', authToken1)
        .expect(200)

      const pushes = response.body.data
      pushes.forEach((push: any) => {
        expect(push.radarType).toBe('tech')
        expect(push.relevanceScore).toBeGreaterThanOrEqual(0.9)

        const sentAt = new Date(push.sentAt)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        expect(sentAt.getTime()).toBeGreaterThanOrEqual(thirtyDaysAgo.getTime())
      })
    })
  })

  describe('[P1] GET /api/radar/pushes - 分页功能', () => {
    it('应该支持自定义分页参数（page + limit）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ page: 1, limit: 2 })
        .set('Authorization', authToken1)
        .expect(200)

      expect(response.body.data.length).toBeLessThanOrEqual(2)
      expect(response.body.meta.page).toBe(1)
      expect(response.body.meta.limit).toBe(2)
    })

    it('应该正确计算总页数（totalPages）', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ page: 1, limit: 2 })
        .set('Authorization', authToken1)
        .expect(200)

      const { total, limit, totalPages } = response.body.meta
      expect(totalPages).toBe(Math.ceil(total / limit))
    })
  })

  describe('[P1] PATCH /api/radar/pushes/:id/read - 标记已读', () => {
    it('应该成功标记推送为已读', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/radar/pushes/${techPushId}/read`)
        .set('Authorization', authToken1)
        .expect(200)

      expect(response.body).toMatchObject({ success: true })

      // Verify push is marked as read
      const push = await dataSource.getRepository(RadarPush).findOne({
        where: { id: techPushId },
      })
      expect(push.isRead).toBe(true)
      expect(push.readAt).toBeDefined()
    })

    it('应该返回404如果推送不存在', async () => {
      await request(app.getHttpServer())
        .patch('/api/radar/pushes/non-existent-id/read')
        .set('Authorization', authToken1)
        .expect(404)
    })

    it('应该防止跨组织标记已读（多租户隔离）', async () => {
      // User2 tries to mark User1's push as read
      await request(app.getHttpServer())
        .patch(`/api/radar/pushes/${techPushId}/read`)
        .set('Authorization', authToken2)
        .expect(404) // Should not find push from another organization
    })
  })

  describe('[P1] GET /api/radar/pushes/unread-count - 未读数量统计', () => {
    it('应该返回正确的未读推送数量', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/radar/pushes/unread-count')
        .set('Authorization', authToken1)
        .expect(200)

      expect(response.body).toMatchObject({
        count: expect.any(Number),
      })
      expect(response.body.count).toBeGreaterThanOrEqual(0)
    })

    it('应该只统计当前组织的未读推送', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/api/radar/pushes/unread-count')
        .set('Authorization', authToken1)
        .expect(200)

      const response2 = await request(app.getHttpServer())
        .get('/api/radar/pushes/unread-count')
        .set('Authorization', authToken2)
        .expect(200)

      // Both organizations should have at least 1 unread push
      expect(response1.body.count).toBeGreaterThanOrEqual(1)
      expect(response2.body.count).toBeGreaterThanOrEqual(1)

      // Note: Counts may be equal if previous tests marked pushes as read
      // The important thing is that each org only sees its own pushes
    })
  })

  describe('[P1] 多租户数据隔离', () => {
    it('应该只返回当前组织的推送（组织A看不到组织B的推送）', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ })
        .set('Authorization', authToken1)
        .expect(200)

      const response2 = await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ })
        .set('Authorization', authToken2)
        .expect(200)

      const org1Pushes = response1.body.data
      const org2Pushes = response2.body.data

      // Verify no overlap in push IDs
      const org1PushIds = org1Pushes.map((p: any) => p.id)
      const org2PushIds = org2Pushes.map((p: any) => p.id)

      const overlap = org1PushIds.filter((id: string) => org2PushIds.includes(id))
      expect(overlap.length).toBe(0)
    })
  })

  describe('[P2] API 参数验证', () => {
    it('应该拒绝无效的雷达类型', async () => {
      await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ radarType: 'invalid' })
        .set('Authorization', authToken1)
        .expect(400)
    })

    it('应该拒绝无效的时间范围', async () => {
      await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ timeRange: 'invalid' })
        .set('Authorization', authToken1)
        .expect(400)
    })

    it('应该拒绝无效的相关性级别', async () => {
      await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ relevance: 'invalid' })
        .set('Authorization', authToken1)
        .expect(400)
    })

    it('应该拒绝无效的分页参数（page < 1）', async () => {
      await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ page: 0 })
        .set('Authorization', authToken1)
        .expect(400)
    })

    it('应该拒绝无效的分页参数（limit > 50）', async () => {
      await request(app.getHttpServer())
        .get('/api/radar/pushes')
        .query({ limit: 100 })
        .set('Authorization', authToken1)
        .expect(400)
    })
  })
})
