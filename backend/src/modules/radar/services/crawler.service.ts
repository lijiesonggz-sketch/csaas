import { Injectable, Logger } from '@nestjs/common'
import { CheerioCrawler } from 'crawlee'
import * as cheerio from 'cheerio'
import { RawContentService } from './raw-content.service'
import { CrawlerLogService } from './crawler-log.service'
import { RawContent } from '../../../database/entities/raw-content.entity'
import {
  MAX_TECH_KEYWORDS,
  MAX_TECH_KEYWORD_LENGTH,
  MIN_TECH_KEYWORD_LENGTH,
  MAX_EFFECT_DESCRIPTION_LENGTH,
} from '../constants/content.constants'

/**
 * CrawlerService
 *
 * 使用Crawlee爬取网站内容
 *
 * Story 2.1: 爬虫和文件导入机制
 */
@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name)

  // User-Agent池，用于轮换
  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  ]

  // ContentType映射：RadarSource的type -> RawContent的contentType
  private readonly CONTENT_TYPE_MAPPING: Record<string, 'article' | 'recruitment' | 'conference'> =
    {
      website: 'article',
      wechat: 'article',
      recruitment: 'recruitment',
      conference: 'conference',
    }

  constructor(
    private readonly rawContentService: RawContentService,
    private readonly crawlerLogService: CrawlerLogService,
  ) {}

  /**
   * 随机选择User-Agent
   */
  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)]
  }

  /**
   * 爬取网站内容
   */
  async crawlWebsite(
    source: string,
    category: 'tech' | 'industry' | 'compliance',
    url: string,
    retryCount: number = 0,
    options?: { contentType?: string; peerName?: string },
  ): Promise<RawContent> {
    this.logger.log(`Starting crawl: ${source} - ${url}`)

    try {
      let crawledData: any = null

      const crawler = new CheerioCrawler({
        maxRequestRetries: 3,
        requestHandlerTimeoutSecs: 60,
        // 配置User-Agent轮换
        requestHandler: async ({ $, request }) => {
          const parsed = this.parseArticleFromCheerio($)
          crawledData = {
            ...parsed,
            url: request.url,
          }
        },
        // 添加请求头配置
        preNavigationHooks: [
          async ({ request }) => {
            request.headers = {
              ...request.headers,
              'User-Agent': this.getRandomUserAgent(),
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
              'Accept-Encoding': 'gzip, deflate, br',
              Connection: 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
            }
          },
        ],
      })

      await crawler.run([url])

      if (!crawledData) {
        throw new Error('Failed to extract content from page')
      }

      // 根据 contentType 选择解析方法
      let rawContentData: any

      // 将 RadarSource 的 type 映射到 RawContent 的 contentType
      const mappedContentType = options?.contentType
        ? this.CONTENT_TYPE_MAPPING[options.contentType] || 'article'
        : 'article'

      if (options?.contentType === 'recruitment') {
        // 使用招聘信息解析
        const html = await this.fetchHtml(url)
        const parsedData = await this.parseRecruitmentJob(html, source)
        rawContentData = {
          ...parsedData,
          url, // 确保 url 字段存在
          peerName: options.peerName || parsedData.peerName,
        }
      } else {
        // 使用文章解析（现有逻辑）
        rawContentData = {
          source,
          category,
          title: crawledData.title,
          summary: crawledData.summary,
          fullContent: crawledData.fullContent,
          url: crawledData.url,
          publishDate: crawledData.publishDate,
          author: crawledData.author,
          contentType: mappedContentType,
          peerName: options?.peerName || null,
          organizationId: null,
        }

        // 如果是行业雷达，提取同业信息
        if (category === 'industry' && crawledData.fullContent) {
          const peerInfo = this.extractPeerInfo(crawledData.fullContent, source)
          rawContentData = {
            ...rawContentData,
            peerName: rawContentData.peerName || peerInfo.peerName,
          }
        }
      }

      // 保存到RawContent表
      const rawContent = await this.rawContentService.create(rawContentData)

      // 记录成功日志
      await this.crawlerLogService.logSuccess(source, category, url, 1)

      this.logger.log(`Crawl successful: ${source} - ${url}`)
      return rawContent
    } catch (error) {
      this.logger.error(`Crawl failed: ${source} - ${url}`, error.stack)

      // 记录失败日志（传递正确的重试次数）
      await this.crawlerLogService.logFailure(source, category, url, error.message, retryCount)

      throw error
    }
  }

  /**
   * 获取HTML内容（用于招聘信息解析）
   * 使用Crawlee的CheerioCrawler确保反爬虫机制一致性
   */
  private async fetchHtml(url: string): Promise<string> {
    let htmlContent = ''

    const crawler = new CheerioCrawler({
      maxRequestRetries: 3,
      requestHandlerTimeoutSecs: 60,
      requestHandler: async ({ body }) => {
        htmlContent = body.toString()
      },
      preNavigationHooks: [
        async ({ request }) => {
          request.headers = {
            ...request.headers,
            'User-Agent': this.getRandomUserAgent(),
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            Connection: 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          }
        },
      ],
    })

    await crawler.run([url])

    if (!htmlContent) {
      throw new Error('Failed to fetch HTML content')
    }

    return htmlContent
  }

  /**
   * 从Cheerio对象解析文章
   */
  private parseArticleFromCheerio($: cheerio.CheerioAPI): {
    title: string
    summary: string | null
    fullContent: string
    publishDate: Date | null
    author: string | null
  } {
    // 提取标题 - 多种选择器
    const title =
      $('h1').first().text().trim() ||
      $('title').text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      'Untitled'

    // 提取摘要 - 多种选择器
    const summary =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('.summary').first().text().trim() ||
      $('.excerpt').first().text().trim() ||
      null

    // 提取正文 - 优先级顺序
    let fullContent =
      $('article').text().trim() ||
      $('.article-content').text().trim() ||
      $('.post-content').text().trim() ||
      $('.content').text().trim() ||
      $('main').text().trim() ||
      ''

    // 如果正文为空，回退到body但移除导航和页脚
    if (!fullContent) {
      const $body = $('body').clone()
      $body.find('nav, header, footer, .nav, .header, .footer, .sidebar, .menu').remove()
      fullContent = $body.text().trim()
    }

    // 清理正文中的多余空白
    fullContent = fullContent.replace(/\s+/g, ' ').trim()

    // 提取发布日期 - 多种选择器
    let publishDate: Date | null = null
    const timeElement =
      $('time').attr('datetime') ||
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="publish-date"]').attr('content') ||
      $('.publish-date').first().text().trim() ||
      $('.date').first().text().trim()

    if (timeElement) {
      const parsed = new Date(timeElement)
      if (!isNaN(parsed.getTime())) {
        publishDate = parsed
      }
    }

    // 提取作者 - 多种选择器
    const author =
      $('.author').first().text().trim() ||
      $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content') ||
      $('.byline').first().text().trim() ||
      null

    return {
      title,
      summary,
      fullContent,
      publishDate,
      author,
    }
  }

  /**
   * 从HTML字符串解析文章（用于测试）
   */
  parseArticle(html: string): {
    title: string
    summary: string | null
    fullContent: string
    publishDate: Date | null
    author: string | null
  } {
    const $ = cheerio.load(html)
    return this.parseArticleFromCheerio($)
  }

  /**
   * 解析招聘职位信息（Story 3.1）
   * 从职位描述中提取技术栈，推断同业技术使用情况
   */
  async parseRecruitmentJob(html: string, source: string): Promise<Partial<RawContent>> {
    try {
      const $ = cheerio.load(html)

      // 提取职位基本信息 - 多种选择器适配不同招聘网站
      const jobTitle =
        $('.job-title').first().text().trim() ||
        $('.job-name').first().text().trim() ||
        $('h1.job').first().text().trim() ||
        $('h1').first().text().trim() ||
        'Untitled Position'

      const companyName =
        $('.company-name').first().text().trim() ||
        $('.company').first().text().trim() ||
        $('.employer-name').first().text().trim() ||
        'Unknown Company'

      const jobDescription =
        $('.job-description').text().trim() ||
        $('.job-detail').text().trim() ||
        $('.description').text().trim() ||
        $('article').text().trim() ||
        $('main').text().trim() ||
        ''

      // 提取技术栈关键词
      const techKeywords = this.extractTechKeywords(jobDescription)

      // 生成摘要
      const summary =
        techKeywords.length > 0
          ? `招聘要求：${techKeywords.join('、')}`
          : '招聘信息（未识别技术栈）'

      // 生成标题
      const title = `${companyName} - ${jobTitle} (推断技术栈)`

      this.logger.log(
        `Parsed recruitment job: ${companyName} - ${jobTitle}, found ${techKeywords.length} tech keywords`,
      )

      return {
        source,
        category: 'industry',
        title,
        summary,
        fullContent: jobDescription,
        contentType: 'recruitment',
        peerName: companyName,
        organizationId: null,
        status: 'pending',
      }
    } catch (error) {
      this.logger.error(`Failed to parse recruitment job from ${source}:`, error.stack)
      throw new Error(`Recruitment parsing failed: ${error.message}`)
    }
  }

  /**
   * 从文本中提取技术栈关键词（Story 3.1）
   * 匹配 "熟悉XXX"、"精通XXX"、"掌握XXX"、"了解XXX" 等模式
   */
  private extractTechKeywords(text: string): string[] {
    const keywords: string[] = []

    // 正则匹配：\"熟悉XXX\"、\"精通XXX\"、\"掌握XXX\"、\"了解XXX\"
    const regex =
      /(?:熟悉|精通|掌握|了解|使用|开发|应用)[\s:：]*([^。；\n]+?)(?=(?:熟悉|精通|掌握|了解|使用|开发|应用|。|；|\n|$))/g
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      const content = match[1].trim()
      // 分割技术词汇（支持、，/ 等分隔符）
      const techs = content
        .split(/[、,，/\s]+/)
        .map((t) => t.trim())
        .filter((t) => {
          // 过滤：空串、过长内容、纯数字、常见无用词
          if (!t || t.length === 0 || t.length > MAX_TECH_KEYWORD_LENGTH) return false
          if (/^\d+$/.test(t)) return false
          const excludeWords = [
            '等',
            '和',
            '或',
            '的',
            '与',
            '及',
            '要求',
            '如下',
            '以下',
            '维护',
            '完成',
            '业绩',
            '指标',
            '沟通',
            '能力',
            '学历',
          ]
          if (excludeWords.some((word) => t.includes(word))) return false
          // 过滤过短的词（很可能不是技术名词）
          if (t.length < MIN_TECH_KEYWORD_LENGTH) return false
          return true
        })

      keywords.push(...techs)
    }

    // 去重并限制数量
    const uniqueKeywords = Array.from(new Set(keywords))

    // 如果提取数量过多，可能提取有误，返回前MAX_TECH_KEYWORDS个
    return uniqueKeywords.slice(0, MAX_TECH_KEYWORDS)
  }

  /**
   * 从文章内容中提取同业机构信息（Story 3.1）
   */
  extractPeerInfo(
    content: string,
    source: string,
  ): {
    peerName?: string
    estimatedCost?: string
    implementationPeriod?: string
    technicalEffect?: string
  } {
    const result: any = {}

    // 从source推断同业名称
    // 匹配：银行、保险、证券、基金等金融机构（支持中英文）
    const peerMatch = source.match(
      /([\u4e00-\u9fa5]+银行|[\u4e00-\u9fa5]+保险|[\u4e00-\u9fa5]+证券|[\u4e00-\u9fa5]+基金|[A-Z][a-z]+\s?Bank|[A-Z][a-z]+\s?Insurance)/,
    )
    if (peerMatch) {
      result.peerName = peerMatch[1]
    }

    // 提取投入成本
    // 匹配：\"投入120万\"、\"预算约80万\"、\"成本约为50-100万\"
    const costMatch = content.match(/(?:投入|预算|花费|成本)[\s约为:：]*([0-9.-]+)\s*万/)
    if (costMatch) {
      result.estimatedCost = `${costMatch[1]}万`
    }

    // 提取实施周期
    // 匹配：\"历时6个月\"、\"用时3周\"、\"周期约3-6个月\"
    const durationMatch = content.match(
      /(?:历时|用时|耗时|周期)[\s约为:：]*([0-9-]+)\s*(个月|月|周|天)/,
    )
    if (durationMatch) {
      result.implementationPeriod = `${durationMatch[1]}${durationMatch[2]}`
    }

    // 提取技术效果（关键词匹配）
    const effectKeywords = ['提升', '降低', '节省', '缩短', '提高', '优化']
    for (const keyword of effectKeywords) {
      // 匹配包含效果关键词的句子（限制长度避免过长）
      const effectMatch = content.match(
        new RegExp(`${keyword}[^。；\n]{0,${MAX_EFFECT_DESCRIPTION_LENGTH}}`),
      )
      if (effectMatch) {
        result.technicalEffect = effectMatch[0].trim()
        break
      }
    }

    return result
  }
}
