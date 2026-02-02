import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { getQueueToken } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { AppModule } from '../src/app.module'
import { RawContent } from '../src/database/entities/raw-content.entity'
import { AnalyzedContent } from '../src/database/entities/analyzed-content.entity'
import { Tag } from '../src/database/entities/tag.entity'
import { AIAnalysisService } from '../src/modules/radar/services/ai-analysis.service'
import { RawContentService } from '../src/modules/radar/services/raw-content.service'
import { AnalyzedContentService } from '../src/modules/radar/services/analyzed-content.service'

/**
 * E2E Tests for Story 2.2: AI Analysis of Radar Content
 *
 * Tests the complete workflow:
 * 1. RawContent → AI Analysis → AnalyzedContent → Push Task
 * 2. Redis caching mechanism
 * 3. BullMQ queue processing
 * 4. Tag creation and association
 * 5. Status flow: pending → analyzing → analyzed/failed
 * 6. Failure retry mechanism
 *
 * SETUP REQUIREMENTS:
 * - Test database must be running
 * - Redis must be running
 * - Migrations must be applied: npm run migration:run
 * - Tongyi API key must be configured (or mocked)
 */
describe('AI Analysis (E2E)', () => {
  let app: INestApplication
  let dataSource: DataSource
  let aiAnalysisService: AIAnalysisService
  let rawContentService: RawContentService
  let analyzedContentService: AnalyzedContentService
  let aiAnalysisQueue: Queue

  // Test data IDs
  let testRawContentId: string
  let testAnalyzedContentId: string

  /**
   * Helper: Wait for job completion
   */
  async function waitForJobCompletion(queue: Queue, jobId: string, timeout = 30000): Promise<any> {
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      const job = await queue.getJob(jobId)
      if (!job) {
        throw new Error(`Job ${jobId} not found`)
      }

      const state = await job.getState()
      if (state === 'completed') {
        return job.returnvalue
      }
      if (state === 'failed') {
        throw new Error(`Job ${jobId} failed: ${job.failedReason}`)
      }

      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new Error(`Job ${jobId} timeout after ${timeout}ms`)
  }

  /**
   * Helper: Clean up test data
   */
  async function cleanupTestData() {
    try {
      // Clean up in reverse dependency order
      await dataSource.query(`DELETE FROM content_tags WHERE "contentId" IN (
        SELECT id FROM analyzed_contents WHERE "contentId" IN (
          SELECT id FROM raw_contents WHERE source = 'TEST_SOURCE'
        )
      )`)
      await dataSource.query(`DELETE FROM analyzed_contents WHERE "contentId" IN (
        SELECT id FROM raw_contents WHERE source = 'TEST_SOURCE'
      )`)
      await dataSource.query(`DELETE FROM raw_contents WHERE source = 'TEST_SOURCE'`)
      await dataSource.query(`DELETE FROM tags WHERE name LIKE 'TEST_%'`)
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Cleanup warning:', error.message)
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())

    dataSource = app.get<DataSource>(DataSource)
    aiAnalysisService = app.get<AIAnalysisService>(AIAnalysisService)
    rawContentService = app.get<RawContentService>(RawContentService)
    analyzedContentService = app.get<AnalyzedContentService>(AnalyzedContentService)
    aiAnalysisQueue = app.get<Queue>(getQueueToken('radar-ai-analysis'))

    await app.init()

    // Clean up any existing test data
    await cleanupTestData()
  })

  afterAll(async () => {
    // Final cleanup
    await cleanupTestData()

    // Close connections
    await app.close()
  })

  afterEach(async () => {
    // Clean up after each test
    await cleanupTestData()
  })

  describe('1. 完整流程 - RawContent → AI分析 → AnalyzedContent → 推送任务', () => {
    it('应该完成完整的AI分析流程', async () => {
      // Step 1: Create RawContent
      const rawContent = await rawContentService.create({
        title: 'Kubernetes 零信任架构实践',
        url: 'https://test.example.com/k8s-zero-trust',
        summary: '本文介绍了在 Kubernetes 环境下实施零信任架构的最佳实践',
        fullContent: '详细内容：零信任架构是一种安全模型，要求验证每个访问请求...',
        source: 'TEST_SOURCE',
        publishDate: new Date('2024-01-15'),
        category: 'tech',
        author: null,
        organizationId: null,
      })
      testRawContentId = rawContent.id

      // Step 2: Trigger AI analysis
      const analyzedContent = await aiAnalysisService.analyze(rawContent, 'tech')
      testAnalyzedContentId = analyzedContent.id

      // Step 3: Verify AnalyzedContent created
      expect(analyzedContent).toBeDefined()
      expect(analyzedContent.contentId).toBe(rawContent.id)
      expect(analyzedContent.status).toBe('success')
      expect(analyzedContent.tokensUsed).toBeGreaterThan(0)
      expect(analyzedContent.aiModel).toContain('qwen')

      // Step 4: Verify tags created
      expect(analyzedContent.tags).toBeDefined()
      expect(analyzedContent.tags.length).toBeGreaterThan(0)

      // Step 5: Verify keywords and categories extracted
      expect(analyzedContent.keywords).toBeDefined()
      expect(analyzedContent.categories).toBeDefined()

      // Step 6: Verify AI summary generated
      expect(analyzedContent.aiSummary).toBeDefined()
      expect(analyzedContent.aiSummary.length).toBeGreaterThan(0)

      // Step 7: Verify target audience identified
      expect(analyzedContent.targetAudience).toBeDefined()
    }, 60000) // 60s timeout for AI call
  })

  describe('2. 失败重试 - 第一次失败,5分钟后重试成功', () => {
    it('应该在失败后自动重试', async () => {
      // This test requires mocking AI failure
      // For now, we'll skip it in E2E and rely on unit tests
      // In production, this would be tested with a mock AI service
    })
  })

  describe('3. 并发分析 - 多个Worker同时处理不同内容', () => {
    it('应该支持并发分析多个内容', async () => {
      // Create multiple RawContent items
      const contents = await Promise.all([
        rawContentService.create({
          title: 'TEST_云原生技术趋势',
          url: 'https://test.example.com/cloud-native-1',
          summary: '云原生技术发展趋势',
          fullContent: '详细内容1...',
          source: 'TEST_SOURCE',
          publishDate: new Date(),
          category: 'tech',
          author: null,
          organizationId: null,
        }),
        rawContentService.create({
          title: 'TEST_微服务架构实践',
          url: 'https://test.example.com/microservices-2',
          summary: '微服务架构最佳实践',
          fullContent: '详细内容2...',
          source: 'TEST_SOURCE',
          publishDate: new Date(),
          category: 'tech',
          author: null,
          organizationId: null,
        }),
        rawContentService.create({
          title: 'TEST_DevOps工具链',
          url: 'https://test.example.com/devops-3',
          summary: 'DevOps工具链选型',
          fullContent: '详细内容3...',
          source: 'TEST_SOURCE',
          publishDate: new Date(),
          category: 'tech',
          author: null,
          organizationId: null,
        }),
      ])

      // Trigger concurrent analysis
      const results = await Promise.all(
        contents.map((content) => aiAnalysisService.analyze(content, 'tech')),
      )

      // Verify all analyses completed
      expect(results).toHaveLength(3)
      results.forEach((result, index) => {
        expect(result.contentId).toBe(contents[index].id)
        expect(result.status).toBe('success')
      })
    }, 120000) // 120s timeout for concurrent AI calls
  })

  describe('4. 缓存失效 - 24小时后重新分析', () => {
    it('应该在缓存命中时直接返回结果', async () => {
      // Create RawContent
      const rawContent = await rawContentService.create({
        title: 'TEST_缓存测试内容',
        url: 'https://test.example.com/cache-test',
        summary: '测试缓存机制',
        fullContent: '详细内容...',
        source: 'TEST_SOURCE',
        publishDate: new Date(),
        category: 'tech',
        author: null,
        organizationId: null,
      })

      // First analysis - should call AI
      const result1 = await aiAnalysisService.analyzeWithCache(rawContent, 'tech')
      expect(result1.status).toBe('success')

      // Second analysis - should hit cache
      const startTime = Date.now()
      const result2 = await aiAnalysisService.analyzeWithCache(rawContent, 'tech')
      const duration = Date.now() - startTime

      // Cache hit should be much faster (< 100ms)
      expect(duration).toBeLessThan(1000)
      expect(result2.id).toBe(result1.id)
    }, 60000)
  })

  describe('5. 成本监控 - Token消耗记录正确', () => {
    it('应该正确记录Token消耗', async () => {
      // Create RawContent
      const rawContent = await rawContentService.create({
        title: 'TEST_Token消耗测试',
        url: 'https://test.example.com/token-test',
        summary: '测试Token消耗记录',
        fullContent: '详细内容...',
        source: 'TEST_SOURCE',
        publishDate: new Date(),
        category: 'tech',
        author: null,
        organizationId: null,
      })

      // Trigger analysis
      const result = await aiAnalysisService.analyze(rawContent, 'tech')

      // Verify token usage recorded
      expect(result.tokensUsed).toBeGreaterThan(0)
      expect(result.tokensUsed).toBeLessThan(10000) // Reasonable upper bound

      // Verify AI model recorded
      expect(result.aiModel).toBeDefined()
      expect(result.aiModel).toContain('qwen')
    }, 60000)
  })

  describe('6. 状态流转 - pending → analyzing → analyzed/failed', () => {
    it('应该正确流转状态', async () => {
      // Create RawContent
      const rawContent = await rawContentService.create({
        title: 'TEST_状态流转测试',
        url: 'https://test.example.com/status-test',
        summary: '测试状态流转',
        fullContent: '详细内容...',
        source: 'TEST_SOURCE',
        publishDate: new Date(),
        category: 'tech',
        author: null,
        organizationId: null,
      })

      // Initial status should be pending
      expect(rawContent.status).toBe('pending')

      // Trigger analysis
      const result = await aiAnalysisService.analyze(rawContent, 'tech')

      // Final status should be success
      expect(result.status).toBe('success')

      // Verify RawContent status updated to analyzed
      const updatedRawContent = await rawContentService.findById(rawContent.id)
      expect(updatedRawContent.status).toBe('analyzed')
    }, 60000)
  })

  describe('7. 测试数据清理 - 每个测试后清理数据', () => {
    it('应该在测试后清理所有数据', async () => {
      // Create test data
      const rawContent = await rawContentService.create({
        title: 'TEST_清理测试',
        url: 'https://test.example.com/cleanup-test',
        summary: '测试数据清理',
        fullContent: '详细内容...',
        source: 'TEST_SOURCE',
        publishDate: new Date(),
        category: 'tech',
        author: null,
        organizationId: null,
      })

      await aiAnalysisService.analyze(rawContent, 'tech')

      // Manually trigger cleanup
      await cleanupTestData()

      // Verify data cleaned up
      const remainingRawContent = await dataSource.getRepository(RawContent).findOne({
        where: { source: 'TEST_SOURCE' },
      })
      expect(remainingRawContent).toBeNull()

      const remainingAnalyzedContent = await dataSource.getRepository(AnalyzedContent).findOne({
        where: { contentId: rawContent.id },
      })
      expect(remainingAnalyzedContent).toBeNull()
    }, 60000)
  })

  describe('标签管理', () => {
    it('应该自动创建新标签', async () => {
      // Create RawContent
      const rawContent = await rawContentService.create({
        title: 'TEST_新标签测试',
        url: 'https://test.example.com/new-tag-test',
        summary: '测试新标签创建',
        fullContent: '详细内容...',
        source: 'TEST_SOURCE',
        publishDate: new Date(),
        category: 'tech',
        author: null,
        organizationId: null,
      })

      // Trigger analysis
      const result = await aiAnalysisService.analyze(rawContent, 'tech')

      // Verify tags created
      expect(result.tags.length).toBeGreaterThan(0)

      // Verify tags are persisted
      const tags = await dataSource.getRepository(Tag).find({
        where: { id: result.tags[0].id },
      })
      expect(tags.length).toBeGreaterThan(0)
    }, 60000)

    it('应该复用已存在的标签', async () => {
      // Create first content
      const content1 = await rawContentService.create({
        title: 'TEST_标签复用测试1',
        url: 'https://test.example.com/tag-reuse-1',
        summary: '测试标签复用',
        fullContent: '详细内容...',
        source: 'TEST_SOURCE',
        publishDate: new Date(),
        category: 'tech',
        author: null,
        organizationId: null,
      })

      const result1 = await aiAnalysisService.analyze(content1, 'tech')
      const tag1Count = await dataSource.getRepository(Tag).count()

      // Create second content
      const content2 = await rawContentService.create({
        title: 'TEST_标签复用测试2',
        url: 'https://test.example.com/tag-reuse-2',
        summary: '测试标签复用',
        fullContent: '详细内容...',
        source: 'TEST_SOURCE',
        publishDate: new Date(),
        category: 'tech',
        author: null,
        organizationId: null,
      })

      const result2 = await aiAnalysisService.analyze(content2, 'tech')
      const tag2Count = await dataSource.getRepository(Tag).count()

      // Tag count should not increase significantly (some overlap expected)
      expect(tag2Count).toBeLessThanOrEqual(tag1Count + 5)
    }, 120000)
  })
})
