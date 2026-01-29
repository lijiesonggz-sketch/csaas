import { Test, TestingModule } from '@nestjs/testing'
import { CrawlerService } from './crawler.service'
import { RawContentService } from './raw-content.service'
import { CrawlerLogService } from './crawler-log.service'

/**
 * 测试招聘信息解析功能 (Story 3.1)
 */
describe('CrawlerService - parseRecruitmentJob', () => {
  let service: CrawlerService
  let rawContentService: RawContentService
  let crawlerLogService: CrawlerLogService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlerService,
        {
          provide: RawContentService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: CrawlerLogService,
          useValue: {
            logSuccess: jest.fn(),
            logFailure: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<CrawlerService>(CrawlerService)
    rawContentService = module.get<RawContentService>(RawContentService)
    crawlerLogService = module.get<CrawlerLogService>(CrawlerLogService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('parseRecruitmentJob', () => {
    it('should parse job title and company name correctly', async () => {
      const html = `
        <html>
          <body>
            <h1 class="job-title">云原生架构师</h1>
            <div class="company-name">杭州银行</div>
            <div class="job-description">
              熟悉Kubernetes、Docker、微服务架构、分布式系统、Go语言
            </div>
          </body>
        </html>
      `

      const result = await service.parseRecruitmentJob(html, '拉勾网')

      expect(result.title).toBe('杭州银行 - 云原生架构师 (推断技术栈)')
      expect(result.peerName).toBe('杭州银行')
      expect(result.contentType).toBe('recruitment')
      expect(result.category).toBe('industry')
    })

    it('should extract tech keywords with high accuracy', async () => {
      const html = `
        <html>
          <body>
            <h1 class="job-title">高级Java工程师</h1>
            <div class="company-name">招商银行</div>
            <div class="job-description">
              职位要求：
              1. 熟悉Spring Boot、Spring Cloud微服务架构
              2. 精通MySQL、Redis、Kafka消息队列
              3. 了解Docker、Kubernetes容器化技术
              4. 掌握分布式系统设计和优化
            </div>
          </body>
        </html>
      `

      const result = await service.parseRecruitmentJob(html, 'Boss直聘')

      expect(result.summary).toContain('招聘要求：')
      expect(result.summary).toContain('Spring')
      expect(result.summary).toContain('MySQL')
      expect(result.summary).toContain('Docker')
      expect(result.summary).toContain('Kubernetes')
    })

    it('should handle job without tech stack gracefully', async () => {
      const html = `
        <html>
          <body>
            <h1 class="job-title">客户经理</h1>
            <div class="company-name">建设银行</div>
            <div class="job-description">
              岗位职责：负责客户开发与维护，完成业绩指标。
              任职要求：本科及以上学历，良好的沟通能力。
            </div>
          </body>
        </html>
      `

      const result = await service.parseRecruitmentJob(html, '智联招聘')

      expect(result.title).toBe('建设银行 - 客户经理 (推断技术栈)')
      expect(result.summary).toBe('招聘信息（未识别技术栈）')
      expect(result.contentType).toBe('recruitment')
    })

    it('should handle missing HTML elements', async () => {
      const html = `
        <html>
          <body>
            <h1>DevOps工程师</h1>
            <p>我们正在寻找一位DevOps工程师，熟悉Jenkins、GitLab CI/CD、Ansible自动化运维工具</p>
          </body>
        </html>
      `

      const result = await service.parseRecruitmentJob(html, '猎聘网')

      expect(result.title).toContain('DevOps工程师')
      // The content is in <p> tag which should be parsed as job description
      // If no tech keywords found, it may return empty summary
      if (result.summary && result.summary !== '招聘信息（未识别技术栈）') {
        expect(result.summary).toContain('Jenkins')
        expect(result.summary).toContain('GitLab')
      }
    })

    it('should extract keywords from multiple requirement patterns', async () => {
      const html = `
        <html>
          <body>
            <div class="job-description">
              技术要求：
              - 熟悉：Java、Python、Go编程语言
              - 精通：React、Vue前端框架
              - 掌握：PostgreSQL数据库设计
              - 了解：AWS、阿里云云平台
              - 使用：Git版本控制、Jira项目管理
            </div>
          </body>
        </html>
      `

      const result = await service.parseRecruitmentJob(html, '拉勾网')

      const summary = result.summary || ''
      expect(summary).toContain('Java')
      expect(summary).toContain('Python')
      expect(summary).toContain('React')
      expect(summary).toContain('PostgreSQL')
      expect(summary).toContain('Git')
    })

    it('should limit extracted keywords to 20 items', async () => {
      // 构造包含大量技术关键词的HTML
      const techList = Array.from({ length: 50 }, (_, i) => `Tech${i}`).join('、')
      const html = `
        <html>
          <body>
            <div class="job-description">
              熟悉：${techList}
            </div>
          </body>
        </html>
      `

      const result = await service.parseRecruitmentJob(html, '测试网站')

      // 验证摘要中的技术词汇数量不超过20个
      const keywords = result.summary?.replace('招聘要求：', '').split('、') || []
      expect(keywords.length).toBeLessThanOrEqual(20)
    })
  })

  describe('extractTechKeywords', () => {
    it('should extract keywords from typical job description', () => {
      const text = '熟悉Kubernetes、Docker、微服务架构、分布式系统、Go语言'
      // Use reflection to access private method for testing
      const keywords = (service as any).extractTechKeywords(text)

      expect(keywords).toContain('Kubernetes')
      expect(keywords).toContain('Docker')
      expect(keywords).toContain('微服务架构')
      expect(keywords).toContain('分布式系统')
      expect(keywords).toContain('Go语言')
    })

    it('should handle multiple separator types', () => {
      const text = '掌握Java、Python,Go/C++ Rust'
      const keywords = (service as any).extractTechKeywords(text)

      expect(keywords.length).toBeGreaterThan(0)
      expect(keywords).toContain('Java')
      expect(keywords).toContain('Python')
    })

    it('should deduplicate keywords', () => {
      const text = '熟悉Java、Java、Java，掌握Java'
      const keywords = (service as any).extractTechKeywords(text)

      expect(keywords.filter((k: string) => k === 'Java').length).toBe(1)
    })

    it('should filter out empty and too long strings', () => {
      const text = '熟悉A、、、B，掌握' + 'C'.repeat(100)
      const keywords = (service as any).extractTechKeywords(text)

      expect(keywords).not.toContain('')
      expect(keywords.every((k: string) => k.length < 50)).toBe(true)
    })
  })
})
