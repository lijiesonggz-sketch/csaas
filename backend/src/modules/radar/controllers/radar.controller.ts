import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CrawlerLogService } from '../services/crawler-log.service'
import { RawContentService } from '../services/raw-content.service'

/**
 * RadarController
 *
 * 提供爬虫状态和统计信息的API端点
 *
 * Story 2.1: 爬虫和文件导入机制
 */
@Controller('radar')
@UseGuards(JwtAuthGuard)
export class RadarController {
  constructor(
    private readonly crawlerLogService: CrawlerLogService,
    private readonly rawContentService: RawContentService,
  ) {}

  /**
   * 获取爬虫统计信息
   */
  @Get('crawler/stats')
  async getCrawlerStats() {
    const sources = ['GARTNER', '信通院', 'IDC']

    const stats = await Promise.all(
      sources.map(async (source) => {
        const successRate = await this.crawlerLogService.getSuccessRate(source)
        const recentLogs = await this.crawlerLogService.getRecentLogs(source, 5)

        return {
          source,
          successRate,
          recentLogs: recentLogs.map((log) => ({
            status: log.status,
            itemsCollected: log.itemsCollected,
            errorMessage: log.errorMessage,
            crawledAt: log.crawledAt,
          })),
        }
      }),
    )

    return {
      sources: stats,
      timestamp: new Date(),
    }
  }

  /**
   * 获取待分析内容数量
   */
  @Get('content/pending')
  async getPendingContent() {
    const pending = await this.rawContentService.findPending()

    return {
      count: pending.length,
      items: pending.slice(0, 10).map((content) => ({
        id: content.id,
        source: content.source,
        category: content.category,
        title: content.title,
        createdAt: content.createdAt,
      })),
    }
  }

  /**
   * 获取内容统计信息
   */
  @Get('content/stats')
  async getContentStats() {
    // 这里可以添加更多统计逻辑
    const pending = await this.rawContentService.findPending()

    return {
      pendingCount: pending.length,
      timestamp: new Date(),
    }
  }
}
