import { Injectable, Logger } from '@nestjs/common'
import { CheerioCrawler } from 'crawlee'
import * as cheerio from 'cheerio'
import { RawContentService } from './raw-content.service'
import { CrawlerLogService } from './crawler-log.service'
import { RawContent } from '../../../database/entities/raw-content.entity'

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
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
            }
          },
        ],
      })

      await crawler.run([url])

      if (!crawledData) {
        throw new Error('Failed to extract content from page')
      }

      // 保存到RawContent表
      const rawContent = await this.rawContentService.create({
        source,
        category,
        title: crawledData.title,
        summary: crawledData.summary,
        fullContent: crawledData.fullContent,
        url: crawledData.url,
        publishDate: crawledData.publishDate,
        author: crawledData.author,
        organizationId: null, // 公共内容
      })

      // 记录成功日志
      await this.crawlerLogService.logSuccess(source, category, url, 1)

      this.logger.log(`Crawl successful: ${source} - ${url}`)
      return rawContent
    } catch (error) {
      this.logger.error(`Crawl failed: ${source} - ${url}`, error.stack)

      // 记录失败日志（传递正确的重试次数）
      await this.crawlerLogService.logFailure(
        source,
        category,
        url,
        error.message,
        retryCount,
      )

      throw error
    }
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
    let title =
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
}
