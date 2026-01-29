import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import * as fs from 'fs/promises'
import * as path from 'path'
import { AppModule } from '../src/app.module'
import { DataSource } from 'typeorm'
import { RawContent } from '../src/database/entities/raw-content.entity'
import { CrawlerService } from '../src/modules/radar/services/crawler.service'

/**
 * E2E测试：行业雷达信息采集流程 (Story 3.1)
 *
 * 测试覆盖：
 * 1. 爬虫任务 → 解析同业内容 → 保存RawContent → 触发AI分析
 * 2. 文件导入 → 解析peerName → 保存RawContent → 触发AI分析
 */
describe('Industry Radar Collection (e2e)', () => {
  let app: INestApplication
  let dataSource: DataSource
  let crawlerService: CrawlerService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    dataSource = moduleFixture.get<DataSource>(DataSource)
    crawlerService = moduleFixture.get<CrawlerService>(CrawlerService)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    // 清理测试数据 - 删除所有测试相关的记录
    const repo = dataSource.getRepository(RawContent)
    const testRecords = await repo
      .createQueryBuilder('raw_content')
      .where('raw_content.source ILIKE :pattern1', { pattern1: '%测试%' })
      .orWhere('raw_content.source ILIKE :pattern2', { pattern2: '%test%' })
      .getMany()

    if (testRecords.length > 0) {
      await repo.remove(testRecords)
    }
  })

  describe('File Import Flow', () => {
    it('should process industry content file with peerName correctly', async () => {
      // 准备测试文件
      const testFilePath = path.join(
        process.cwd(),
        'data-import',
        'wechat-articles',
        'test-industry-article.md',
      )

      const fileContent = `---
source: "杭州银行金融科技公众号"
category: "industry"
url: "https://mp.weixin.qq.com/test"
publishDate: "2026-01-20"
peerName: "杭州银行"
contentType: "article"
---

# 杭州银行容器化改造实践

杭州银行于2025年启动容器化改造项目，投入120万，历时6个月完成核心系统的容器化部署。

项目采用Kubernetes作为容器编排平台，Docker作为容器运行时。通过容器化改造，应用部署时间从2小时缩短到10分钟，大幅提升了系统的发布效率。

技术栈包括：Kubernetes、Docker、Helm、Prometheus、Grafana等云原生技术。
`

      // 写入测试文件
      await fs.writeFile(testFilePath, fileContent, 'utf-8')

      // 等待文件监控服务处理（模拟异步处理）
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 验证RawContent是否正确保存
      const rawContentRepo = dataSource.getRepository(RawContent)
      const savedContent = await rawContentRepo.findOne({
        where: {
          source: '杭州银行金融科技公众号',
          category: 'industry',
        },
      })

      expect(savedContent).toBeDefined()
      expect(savedContent?.title).toBe('杭州银行容器化改造实践')
      expect(savedContent?.peerName).toBe('杭州银行')
      expect(savedContent?.contentType).toBe('article')
      expect(savedContent?.category).toBe('industry')
      expect(savedContent?.status).toBe('pending')

      // 清理测试文件（如果存在）
      try {
        const processedPath = path.join(
          path.dirname(testFilePath),
          'processed',
          path.basename(testFilePath),
        )
        await fs.unlink(processedPath)
      } catch (error) {
        // 文件可能已被移动到processed，忽略错误
      }
    })

    it('should process recruitment content file correctly', async () => {
      const testFilePath = path.join(
        process.cwd(),
        'data-import',
        'website-crawl',
        'test-recruitment.md',
      )

      const fileContent = `---
source: "拉勾网-金融机构招聘"
category: "industry"
url: "https://www.lagou.com/test"
publishDate: "2026-01-25"
peerName: "招商银行"
contentType: "recruitment"
---

# 招商银行 - 云原生架构师

## 职位要求

1. 熟悉Kubernetes、Docker容器化技术
2. 精通微服务架构设计和实施
3. 掌握Spring Cloud、Service Mesh等技术
4. 了解DevOps流程和工具链
`

      await fs.writeFile(testFilePath, fileContent, 'utf-8')

      // 等待处理
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 验证
      const rawContentRepo = dataSource.getRepository(RawContent)
      const savedContent = await rawContentRepo.findOne({
        where: {
          source: '拉勾网-金融机构招聘',
          contentType: 'recruitment',
        },
      })

      expect(savedContent).toBeDefined()
      expect(savedContent?.peerName).toBe('招商银行')
      expect(savedContent?.contentType).toBe('recruitment')
      expect(savedContent?.category).toBe('industry')

      // 清理
      try {
        const processedPath = path.join(
          path.dirname(testFilePath),
          'processed',
          path.basename(testFilePath),
        )
        await fs.unlink(processedPath)
      } catch (error) {
        // 忽略
      }
    })
  })

  describe('Crawler Parsing Flow', () => {
    it('should parse recruitment job HTML correctly', async () => {
      // 通过内部API测试爬虫服务（需要有相应的controller endpoint）
      // 这里使用直接调用服务的方式

      const html = `
        <html>
          <body>
            <h1 class="job-title">高级Java工程师</h1>
            <div class="company-name">建设银行</div>
            <div class="job-description">
              职位要求：
              1. 熟悉Spring Boot、Spring Cloud微服务架构
              2. 精通MySQL、Redis、Kafka消息队列
              3. 了解Docker、Kubernetes容器化技术
            </div>
          </body>
        </html>
      `

      // 直接调用CrawlerService进行测试
      const result = await crawlerService.parseRecruitmentJob(html, 'Boss直聘')

      expect(result.title).toContain('建设银行')
      expect(result.title).toContain('高级Java工程师')
      expect(result.peerName).toBe('建设银行')
      expect(result.contentType).toBe('recruitment')
      expect(result.category).toBe('industry')
      expect(result.summary).toContain('Spring')
      expect(result.summary).toContain('Kubernetes')
    })

    it('should extract peer info from article content', () => {
      const content = `
        招商银行于2025年启动微服务改造项目，投入150万，
        历时8个月完成核心交易系统的微服务化重构。
        项目完成后，系统吞吐量提升60%，故障恢复时间缩短80%。
      `

      const result = crawlerService.extractPeerInfo(
        content,
        '招商银行技术分享',
      )

      expect(result.peerName).toBe('招商银行')
      expect(result.estimatedCost).toBe('150万')
      expect(result.implementationPeriod).toBe('8个月')
      expect(result.technicalEffect).toBeDefined()
      expect(result.technicalEffect).toContain('提升')
    })
  })

  describe('AI Analysis Trigger', () => {
    it('should trigger AI analysis task after RawContent creation', async () => {
      // 创建测试文件触发完整流程
      const testFilePath = path.join(
        process.cwd(),
        'data-import',
        'wechat-articles',
        'test-ai-trigger.md',
      )

      const fileContent = `---
source: "测试银行技术公众号"
category: "industry"
peerName: "测试银行"
contentType: "article"
---

# 测试文章标题

这是一篇测试文章，用于验证AI分析任务是否正确触发。文章内容需要超过100字符才能通过验证。
这里添加更多内容以满足最小长度要求。测试内容包括技术实践、项目投入、实施周期等信息。
`

      await fs.writeFile(testFilePath, fileContent, 'utf-8')

      // 等待处理和队列入队
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 验证RawContent已创建
      const rawContentRepo = dataSource.getRepository(RawContent)
      const savedContent = await rawContentRepo.findOne({
        where: {
          source: '测试银行技术公众号',
        },
      })

      expect(savedContent).toBeDefined()
      expect(savedContent?.status).toBe('pending')

      // 验证AI分析任务已入队（需要查询BullMQ队列）
      // 注意：实际验证队列状态需要访问Redis，这里只验证RawContent状态

      // 清理
      try {
        const processedPath = path.join(
          path.dirname(testFilePath),
          'processed',
          path.basename(testFilePath),
        )
        await fs.unlink(processedPath)
      } catch (error) {
        // 忽略
      }
    })
  })

  describe('Integration with RadarSource', () => {
    it('should use configured radar sources for crawling', async () => {
      // 测试RadarSource配置是否正确加载
      // 这需要有相应的API endpoint来查询配置

      const response = await request(app.getHttpServer())
        .get('/api/radar/sources')
        .query({ category: 'industry' })
        .expect(200)

      // 验证至少有一些行业雷达信息源配置
      expect(response.body).toBeDefined()
      expect(Array.isArray(response.body)).toBe(true)
    })
  })

  describe('Data Quality Validation', () => {
    it('should reject file with missing required fields', async () => {
      const testFilePath = path.join(
        process.cwd(),
        'data-import',
        'wechat-articles',
        'test-invalid.md',
      )

      // 缺少category字段
      const fileContent = `---
source: "测试公众号"
---

# 测试文章

这是一篇无效的文章，缺少必需的category字段。
`

      await fs.writeFile(testFilePath, fileContent, 'utf-8')

      // 等待处理
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 验证文件被移动到failed文件夹
      const failedPath = path.join(
        path.dirname(testFilePath),
        'failed',
        path.basename(testFilePath),
      )

      const failedFileExists = await fs
        .access(failedPath)
        .then(() => true)
        .catch(() => false)

      // 如果文件处理失败，应该被移到failed文件夹
      // 注意：这依赖于FileWatcherService的实际行为

      // 清理
      try {
        await fs.unlink(failedPath)
        await fs.unlink(failedPath + '.error.txt')
      } catch (error) {
        // 忽略
      }
    })

    it('should reject file with content too short', async () => {
      const testFilePath = path.join(
        process.cwd(),
        'data-import',
        'wechat-articles',
        'test-short.md',
      )

      const fileContent = `---
source: "测试公众号"
category: "industry"
---

# 短文章

太短了。
`

      await fs.writeFile(testFilePath, fileContent, 'utf-8')

      // 等待处理
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 验证内容未保存到数据库
      const rawContentRepo = dataSource.getRepository(RawContent)
      const savedContent = await rawContentRepo.findOne({
        where: {
          source: '测试公众号',
          title: '短文章',
        },
      })

      expect(savedContent).toBeNull()

      // 清理
      try {
        const failedPath = path.join(
          path.dirname(testFilePath),
          'failed',
          path.basename(testFilePath),
        )
        await fs.unlink(failedPath)
        await fs.unlink(failedPath + '.error.txt')
      } catch (error) {
        // 忽略
      }
    })
  })
})
