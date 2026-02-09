import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { RadarSource } from '../../../database/entities/radar-source.entity'

/**
 * RadarSourceSchedulerService
 *
 * Story 8.1: 同业采集源管理 - 定时任务调度
 *
 * 管理雷达信息源的定时爬虫任务：
 * - 创建时：如果 isActive=true，添加到调度队列
 * - 更新时：如果 crawlSchedule 变更，重新调度
 * - 删除时：从调度队列中移除
 */
@Injectable()
export class RadarSourceSchedulerService {
  private readonly logger = new Logger(RadarSourceSchedulerService.name)

  constructor(
    @InjectQueue('radar-crawler')
    private readonly crawlerQueue: Queue,
  ) {}

  /**
   * 为信息源创建定时爬虫任务
   * @param source - 雷达信息源
   */
  async scheduleCrawlerJob(source: RadarSource): Promise<void> {
    if (!source.isActive) {
      this.logger.log(`Source ${source.source} is inactive, skipping scheduling`)
      return
    }

    const jobId = this.getJobId(source.id)

    try {
      // 先移除已存在的任务（避免重复）
      await this.removeCrawlerJob(source.id)

      // 创建新的定时任务
      await this.crawlerQueue.add(
        `crawl-${source.category}`,
        {
          source: source.source,
          category: source.category,
          url: source.url,
          type: source.type,
          peerName: source.peerName,
          crawlConfig: source.crawlConfig,
        },
        {
          repeat: {
            pattern: source.crawlSchedule,
          },
          jobId,
        },
      )

      this.logger.log(
        `Scheduled crawler job for ${source.source} (${source.category}): ${source.crawlSchedule}`,
      )
    } catch (error) {
      this.logger.error(
        `Failed to schedule crawler job for ${source.source}:`,
        error.stack,
      )
      throw error
    }
  }

  /**
   * 移除信息源的定时爬虫任务
   * @param sourceId - 信息源 ID
   */
  async removeCrawlerJob(sourceId: string): Promise<void> {
    const jobId = this.getJobId(sourceId)

    try {
      // 获取所有重复任务并移除
      const repeatableJobs = await this.crawlerQueue.getRepeatableJobs()
      const jobToRemove = repeatableJobs.find((job) => job.id === jobId)

      if (jobToRemove) {
        await this.crawlerQueue.removeRepeatableByKey(jobToRemove.key)
        this.logger.log(`Removed crawler job for source ${sourceId}`)
      }
    } catch (error) {
      this.logger.error(
        `Failed to remove crawler job for source ${sourceId}:`,
        error.stack,
      )
      throw error
    }
  }

  /**
   * 重新调度信息源的爬虫任务
   * 当 crawlSchedule 或 isActive 变更时调用
   * @param source - 雷达信息源
   * @param oldSchedule - 旧的 cron 表达式（可选）
   * @param wasActive - 之前的启用状态（可选）
   */
  async rescheduleCrawlerJob(
    source: RadarSource,
    oldSchedule?: string,
    wasActive?: boolean,
  ): Promise<void> {
    // 修复：正确处理 schedule 变更，包括从 undefined 到具体值的情况
    const isScheduleChanged = oldSchedule !== source.crawlSchedule
    const isActiveChanged = wasActive !== undefined && wasActive !== source.isActive

    // 如果启用状态变为 false，移除任务
    if (isActiveChanged && !source.isActive) {
      await this.removeCrawlerJob(source.id)
      this.logger.log(`Disabled crawler job for ${source.source}`)
      return
    }

    // 如果启用状态变为 true，或者调度时间变更，重新调度
    if ((isActiveChanged && source.isActive) || isScheduleChanged) {
      await this.scheduleCrawlerJob(source)
      this.logger.log(
        `Rescheduled crawler job for ${source.source}: ${source.crawlSchedule}`,
      )
    }
  }

  /**
   * 立即执行一次爬虫任务（用于测试）
   * @param source - 雷达信息源
   */
  async triggerImmediateCrawl(source: RadarSource): Promise<void> {
    try {
      await this.crawlerQueue.add(
        `crawl-${source.category}-immediate`,
        {
          source: source.source,
          category: source.category,
          url: source.url,
          type: source.type,
          peerName: source.peerName,
          crawlConfig: source.crawlConfig,
        },
        {
          jobId: `immediate-${source.id}-${Date.now()}`,
          // 立即执行，不重复
        },
      )

      this.logger.log(`Triggered immediate crawl for ${source.source}`)
    } catch (error) {
      this.logger.error(
        `Failed to trigger immediate crawl for ${source.source}:`,
        error.stack,
      )
      throw error
    }
  }

  /**
   * 获取所有已调度的任务
   */
  async getScheduledJobs(): Promise<
    Array<{
      id: string
      name: string
      pattern: string
      nextExecution: number
    }>
  > {
    try {
      const repeatableJobs = await this.crawlerQueue.getRepeatableJobs()

      return repeatableJobs.map((job) => ({
        id: job.id || '',
        name: job.name,
        pattern: job.pattern || '',
        nextExecution: job.next,
      }))
    } catch (error) {
      this.logger.error('Failed to get scheduled jobs:', error.stack)
      return []
    }
  }

  /**
   * 获取任务 ID
   */
  private getJobId(sourceId: string): string {
    return `crawler-${sourceId}`
  }
}
