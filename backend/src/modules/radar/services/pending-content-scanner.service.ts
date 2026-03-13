import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { RawContentService } from './raw-content.service'

/**
 * PendingContentScannerService - 自动扫描Pending内容并触发AI分析
 *
 * 功能：
 * - 每5分钟扫描一次数据库中的pending状态RawContent
 * - 检查哪些数据尚未在AI分析队列中
 * - 自动将缺失队列任务的数据添加到radar-ai-analysis队列
 */
@Injectable()
export class PendingContentScannerService {
  private readonly logger = new Logger(PendingContentScannerService.name)

  constructor(
    private readonly rawContentService: RawContentService,
    @InjectQueue('radar-ai-analysis')
    private readonly aiAnalysisQueue: Queue,
  ) {}

  /**
   * 每5分钟扫描一次pending内容
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'scan-pending-content',
  })
  async scanPendingContent(): Promise<void> {
    this.logger.log('开始扫描pending状态的内容...')

    try {
      // 1. 获取所有pending状态的内容
      const pendingContents = await this.rawContentService.findPending()

      if (pendingContents.length === 0) {
        this.logger.log('没有pending状态的内容需要处理')
        return
      }

      this.logger.log(`发现 ${pendingContents.length} 条pending状态的内容`)

      // 2. 检查队列中已有的任务
      const jobs = await this.aiAnalysisQueue.getJobs(['waiting', 'active', 'delayed'])
      const queuedContentIds = new Set(jobs.map(job => job.data.contentId))

      // 3. 为缺失队列任务的数据添加任务
      let queuedCount = 0
      for (const content of pendingContents) {
        if (!queuedContentIds.has(content.id)) {
          await this.aiAnalysisQueue.add('analyze-content', {
            contentId: content.id,
            category: content.category,
            priority: this.getPriority(content.category),
          }, {
            priority: this.getPriority(content.category),
          })
          queuedCount++
          this.logger.log(`已为内容 ${content.id} (${content.category}) 添加AI分析任务`)
        }
      }

      this.logger.log(`扫描完成：${queuedCount}/${pendingContents.length} 条内容已添加至队列`)
    } catch (error) {
      this.logger.error('扫描pending内容时出错:', error.stack)
    }
  }

  /**
   * 根据内容类别获取优先级
   */
  private getPriority(category: string): number {
    switch (category) {
      case 'compliance':
        return 1 // 最高优先级
      case 'industry':
        return 2
      case 'tech':
        return 3
      default:
        return 5
    }
  }
}
