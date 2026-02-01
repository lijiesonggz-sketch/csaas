import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
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
import { WatchedPeer } from '../src/database/entities/watched-peer.entity'
import { WeaknessCategory } from '../src/constants/categories'
import { RelevanceService } from '../src/modules/radar/services/relevance.service'
import { PushSchedulerService } from '../src/modules/radar/services/push-scheduler.service'

/**
 * Story 5.2 Task 2.2: matchedPeers集成测试
 *
 * 测试完整的推送流程，验证matchedPeers功能：
 * 1. 行业雷达推送时，matchedPeers正确存储到数据库
 * 2. 行业雷达推送时，多同业匹配场景
 * 3. 技术雷达推送时，matchedPeers为null
 * 4. 无同业匹配时，matchedPeers为null
 * 5. 全文回退匹配场景
 *
 * SETUP REQUIREMENTS:
 * - Test database must be running
 * - Migrations must be applied: npm run migration:run
 * - Redis must be running for BullMQ (可选，集成测试不使用队列)
 */
describe('Story 5.2 Task 2.2: matchedPeers Integration Tests', () => {
  let app: INestApplication
  let dataSource: DataSource
  let relevanceService: RelevanceService

  // Test IDs
  const testUserId = '10000000-0000-0000-0000-000000000001'
  let org1Id: string
  let analyzedContentId: string
  let rawContentMap = new Map<string, any>() // 存储rawContent以便后续使用
  let testRunTimestamp: number // 用于生成唯一的contentHash

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())

    dataSource = app.get<DataSource>(DataSource)
    relevanceService = app.get<RelevanceService>(RelevanceService)

    await app.init()

    // Generate unique timestamp for this test run to ensure contentHash uniqueness
    testRunTimestamp = Date.now()

    // Clean up any existing test data first (in case previous test run failed)
    await cleanupTestData()

    // Create fresh test data
    await setupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await app.close()
  })

  /**
   * Setup test data: users, organizations, weaknesses, topics, watched peers
   */
  async function setupTestData() {
    // Create test user
    const user1 = dataSource.getRepository(User).create({
      id: testUserId,
      name: 'Test User for matchedPeers',
      email: 'test-matched-peers@example.com',
      passwordHash: '$2b$10$test_hash_matched_peers',
      role: UserRole.RESPONDENT,
    })
    await dataSource.getRepository(User).save(user1)

    // Create organization
    const org1 = dataSource.getRepository(Organization).create({
      id: '20000000-0000-0000-0000-000000000001',
      name: 'Test Org for matchedPeers',
      radarActivated: true,
    })
    await dataSource.getRepository(Organization).save(org1)
    org1Id = org1.id

    // Add user to org
    const member1 = dataSource.getRepository(OrganizationMember).create({
      userId: testUserId,
      organizationId: org1Id,
      role: 'admin',
    })
    await dataSource.getRepository(OrganizationMember).save(member1)

    // Create weaknesses (to ensure relevance score >= 0.9)
    const weakness1 = dataSource.getRepository(WeaknessSnapshot).create({
      organizationId: org1Id,
      category: WeaknessCategory.DATA_SECURITY,
      level: 1, // 最薄弱
      projectId: null,
    })
    await dataSource.getRepository(WeaknessSnapshot).save(weakness1)

    // Create watched topics (to ensure relevance score >= 0.9)
    const topic1 = dataSource.getRepository(WatchedTopic).create({
      organizationId: org1Id,
      topicName: '数据安全',
      topicType: 'tech',
    })
    await dataSource.getRepository(WatchedTopic).save(topic1)

    // Create watched peers
    const peer1 = dataSource.getRepository(WatchedPeer).create({
      id: '30000000-0000-0000-0000-000000000001',
      organizationId: org1Id,
      peerName: '杭州银行',
      industry: 'banking',
      institutionType: '城商行',
      description: '杭州地区城商行标杆',
    })
    await dataSource.getRepository(WatchedPeer).save(peer1)

    const peer2 = dataSource.getRepository(WatchedPeer).create({
      id: '30000000-0000-0000-0000-000000000002',
      organizationId: org1Id,
      peerName: '招商银行',
      industry: 'banking',
      institutionType: '股份制银行',
      description: '全国性股份制银行',
    })
    await dataSource.getRepository(WatchedPeer).save(peer2)

    // Create tags
    const tag1 = dataSource.getRepository(Tag).create({
      name: '数据加密',
      tagType: 'tech', // 技术标签
      category: 'security',
    })
    await dataSource.getRepository(Tag).save(tag1)

    // Create raw content (industry radar)
    const rawContent1 = dataSource.getRepository(RawContent).create({
      source: 'manual-test',
      title: '杭州银行容器化改造实践',
      summary: '本文介绍杭州银行如何通过容器化改造实现快速部署',
      fullContent: '杭州银行通过容器化改造实现了快速部署和扩展...',
      url: 'https://example.com/hangzhou-bank-container',
      category: 'industry',
      contentType: 'article',
      peerName: '杭州银行',
      contentHash: `hash-hangzhou-bank-001-${testRunTimestamp}`,
      status: 'analyzed',
    })
    await dataSource.getRepository(RawContent).save(rawContent1)
    rawContentMap.set('raw-1', rawContent1)

    // Create analyzed content
    const analyzedContent1 = dataSource.getRepository(AnalyzedContent).create({
      contentId: rawContent1.id,
      status: 'success',
      keywords: ['容器化', '部署'], // Required field
      categories: ['数据安全'], // Use Chinese display name to match weakness category
      tags: [tag1],
      aiModel: 'qwen-max',
      tokensUsed: 100,
      analyzedAt: new Date(),
    })
    await dataSource.getRepository(AnalyzedContent).save(analyzedContent1)
    analyzedContentId = analyzedContent1.id
  }

  /**
   * Cleanup test data
   *
   * 按照外键依赖顺序删除：
   * 1. 先删除有外键的表（子表）
   * 2. 再删除被引用的表（父表）
   */
  async function cleanupTestData() {
    // 如果org1Id不存在，尝试通过testUserId查找
    let targetOrgId = org1Id
    if (!targetOrgId) {
      const member = await dataSource.getRepository(OrganizationMember).findOne({
        where: { userId: testUserId },
      })
      if (member) {
        targetOrgId = member.organizationId
      }
    }

    // 如果没有找到组织ID，尝试通过固定ID查找（测试用的组织ID）
    if (!targetOrgId) {
      const testOrgId = '20000000-0000-0000-0000-000000000001'
      const org = await dataSource.getRepository(Organization).findOne({
        where: { id: testOrgId },
      })
      if (org) {
        targetOrgId = testOrgId
      }
    }

    // 如果仍然没有找到组织，清理manual-test的rawContent和testUser
    if (!targetOrgId) {
      // 删除原始内容
      await dataSource.getRepository(RawContent)
        .delete({ source: 'manual-test' })
      // 删除用户
      await dataSource.getRepository(User)
        .delete({ id: testUserId })
      return
    }

    // 使用delete() + where条件删除测试数据
    // 删除顺序：子表 → 父表

    // 1. 删除推送记录（最外层）
    await dataSource.getRepository(RadarPush)
      .delete({ organizationId: targetOrgId })

    // 2. 删除分析内容（依赖RawContent, Tag）
    await dataSource.createQueryBuilder()
      .delete()
      .from(AnalyzedContent)
      .where('contentId IN (SELECT id FROM raw_contents WHERE source LIKE :source)', { source: 'manual-test%' })
      .execute()

    // 3. 删除关注同业（依赖Organization）
    await dataSource.getRepository(WatchedPeer)
      .delete({ organizationId: targetOrgId })

    // 4. 删除关注领域（依赖Organization）
    await dataSource.getRepository(WatchedTopic)
      .delete({ organizationId: targetOrgId })

    // 5. 删除薄弱快照（依赖Organization）
    await dataSource.getRepository(WeaknessSnapshot)
      .delete({ organizationId: targetOrgId })

    // 6. 删除原始内容
    await dataSource.getRepository(RawContent)
      .delete({ source: 'manual-test' })

    // 7. 删除标签（测试创建的所有标签）
    await dataSource.getRepository(Tag)
      .delete({ tagType: 'tech' }) // 删除所有测试用的技术标签

    // 8. 删除组织成员
    await dataSource.getRepository(OrganizationMember)
      .delete({ userId: testUserId })

    // 9. 删除组织
    await dataSource.getRepository(Organization)
      .delete({ id: targetOrgId })

    // 10. 删除用户
    await dataSource.getRepository(User)
      .delete({ id: testUserId })
  }

  /**
   * 测试1: 行业雷达推送时，matchedPeers正确存储到数据库
   */
  it('should store matchedPeers in database when industry radar push is created', async () => {
    // Act: 计算相关性并创建推送
    await relevanceService.calculateRelevance(analyzedContentId)

    // Assert: 验证推送记录已创建
    const pushes = await dataSource.getRepository(RadarPush).find({
      where: { organizationId: org1Id },
    })

    expect(pushes.length).toBeGreaterThan(0)
    const push = pushes[0]

    // 验证matchedPeers字段
    expect(push.matchedPeers).not.toBeNull()
    expect(push.matchedPeers).toEqual(['杭州银行'])
  })

  /**
   * 测试2: 行业雷达推送时，多同业匹配场景
   */
  it('should store all matched peers when content matches multiple watched peers', async () => {
    // Create raw content that mentions both banks
    const rawContent2 = dataSource.getRepository(RawContent).create({
      source: 'manual-test',
      title: '杭州银行与招商银行的技术合作',
      summary: '两家银行在云原生领域的深度合作',
      fullContent: '杭州银行与招商银行在云原生领域展开深度合作...',
      url: 'https://example.com/collaboration',
      category: 'industry',
      contentType: 'article',
      peerName: null, // 无结构化字段
      contentHash: `hash-collaboration-002-${testRunTimestamp}`,
      status: 'analyzed',
    })
    await dataSource.getRepository(RawContent).save(rawContent2)

    const analyzedContent2 = dataSource.getRepository(AnalyzedContent).create({
      contentId: rawContent2.id,
      status: 'success',
      keywords: ['云原生', '合作'], // Required field
      categories: ['数据安全'], // Use Chinese display name to match weakness category
      tags: [],
      aiModel: 'qwen-max',
      tokensUsed: 100,
      analyzedAt: new Date(),
    })
    await dataSource.getRepository(AnalyzedContent).save(analyzedContent2)

    // Act: 计算相关性
    await relevanceService.calculateRelevance(analyzedContent2.id)

    // Assert: 验证matchedPeers包含两个银行
    const pushes = await dataSource.getRepository(RadarPush).find({
      where: { organizationId: org1Id, contentId: analyzedContent2.id },
    })

    expect(pushes.length).toBeGreaterThan(0)
    const push = pushes[0]

    expect(push.matchedPeers).not.toBeNull()
    expect(push.matchedPeers).toEqual(expect.arrayContaining(['杭州银行', '招商银行']))
  })

  /**
   * 测试3: 技术雷达推送时，matchedPeers为null
   */
  it('should set matchedPeers to null for tech radar pushes', async () => {
    // Create raw content (tech radar)
    const rawContent3 = dataSource.getRepository(RawContent).create({
      source: 'manual-test',
      title: '云原生技术发展趋势',
      summary: '云原生技术的最新发展',
      fullContent: '云原生技术正在快速发展...',
      url: 'https://example.com/tech-article',
      category: 'tech', // 技术雷达
      contentType: 'article',
      peerName: null,
      contentHash: `hash-tech-003-${testRunTimestamp}`,
      status: 'analyzed',
    })
    await dataSource.getRepository(RawContent).save(rawContent3)

    const analyzedContent3 = dataSource.getRepository(AnalyzedContent).create({
      contentId: rawContent3.id,
      status: 'success',
      keywords: ['云原生', '技术趋势'], // Required field
      categories: ['数据安全'], // Use Chinese display name to match weakness category
      tags: [],
      aiModel: 'qwen-max',
      tokensUsed: 100,
      analyzedAt: new Date(),
    })
    await dataSource.getRepository(AnalyzedContent).save(analyzedContent3)

    // Act: 计算相关性
    await relevanceService.calculateRelevance(analyzedContent3.id)

    // Assert: 验证matchedPeers为null
    const pushes = await dataSource.getRepository(RadarPush).find({
      where: { organizationId: org1Id, contentId: analyzedContent3.id },
    })

    expect(pushes.length).toBeGreaterThan(0)
    const push = pushes[0]

    expect(push.matchedPeers).toBeNull()
  })

  /**
   * 测试4: 无同业匹配时，matchedPeers为null
   */
  it('should set matchedPeers to null when no watched peers match', async () => {
    // Create raw content about a non-watched peer
    const rawContent4 = dataSource.getRepository(RawContent).create({
      source: 'manual-test',
      title: '建设银行数字化转型案例',
      summary: '建设银行如何实现数字化转型',
      fullContent: '建设银行通过数字化手段实现了业务转型...',
      url: 'https://example.com/other-bank',
      category: 'industry',
      contentType: 'article',
      peerName: '建设银行', // 不在关注列表中
      contentHash: `hash-other-bank-004-${testRunTimestamp}`,
      status: 'analyzed',
    })
    await dataSource.getRepository(RawContent).save(rawContent4)

    const analyzedContent4 = dataSource.getRepository(AnalyzedContent).create({
      contentId: rawContent4.id,
      status: 'success',
      keywords: ['数字化', '转型'], // Required field
      categories: ['数据安全'], // Use Chinese display name to match weakness category
      tags: [],
      aiModel: 'qwen-max',
      tokensUsed: 100,
      analyzedAt: new Date(),
    })
    await dataSource.getRepository(AnalyzedContent).save(analyzedContent4)

    // Act: 计算相关性
    await relevanceService.calculateRelevance(analyzedContent4.id)

    // Assert: 验证matchedPeers为null
    const pushes = await dataSource.getRepository(RadarPush).find({
      where: { organizationId: org1Id, contentId: analyzedContent4.id },
    })

    expect(pushes.length).toBeGreaterThan(0)
    const push = pushes[0]

    expect(push.matchedPeers).toBeNull()
  })

  /**
   * 测试5: 全文回退匹配场景
   */
  it('should use fallback matching when structured peerName is null', async () => {
    // Create raw content with peerName in summary only
    const rawContent5 = dataSource.getRepository(RawContent).create({
      source: 'manual-test',
      title: '城商行数字化实践',
      summary: '招商银行通过云原生架构实现了快速部署',
      fullContent: '招商银行采用云原生架构，实现了应用的快速部署和弹性伸缩...',
      url: 'https://example.com/fallback-match',
      category: 'industry',
      contentType: 'article',
      peerName: null, // 结构化字段为空
      contentHash: `hash-fallback-005-${testRunTimestamp}`,
      status: 'analyzed',
    })
    await dataSource.getRepository(RawContent).save(rawContent5)

    const analyzedContent5 = dataSource.getRepository(AnalyzedContent).create({
      contentId: rawContent5.id,
      status: 'success',
      keywords: ['云原生', '部署'], // Required field
      categories: ['数据安全'], // Use Chinese display name to match weakness category
      tags: [],
      aiModel: 'qwen-max',
      tokensUsed: 100,
      analyzedAt: new Date(),
    })
    await dataSource.getRepository(AnalyzedContent).save(analyzedContent5)

    // Act: 计算相关性
    await relevanceService.calculateRelevance(analyzedContent5.id)

    // Assert: 验证matchedPeers通过全文匹配找到招商银行
    const pushes = await dataSource.getRepository(RadarPush).find({
      where: { organizationId: org1Id, contentId: analyzedContent5.id },
    })

    expect(pushes.length).toBeGreaterThan(0)
    const push = pushes[0]

    expect(push.matchedPeers).not.toBeNull()
    expect(push.matchedPeers).toEqual(['招商银行'])
  })
})
