import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { AIAnalysisService } from '../services/ai-analysis.service'
import { RawContentService } from '../services/raw-content.service'
import { AnalyzedContentService } from '../services/analyzed-content.service'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { RadarPush } from '../../../database/entities/radar-push.entity'

/**
 * PlaybookGenerationProcessor - 合规剧本生成队列处理器
 *
 * Story 4.2 - Phase 2.2: 异步生成合规应对剧本
 *
 * 任务流程：
 * 1. 从队列中取出 contentId 和 analyzedContentId
 * 2. 更新 RadarPush 状态为 'generating'
 * 3. 调用 AIAnalysisService.generateCompliancePlaybook()
 * 4. 更新状态为 'ready' 或 'failed'
 *
 * 特性：
 * - 异步生成，不阻塞推送流程
 * - 状态管理：ready → generating → ready/failed
 * - 容错处理：剧本生成失败不影响推送
 */
@Processor('radar-playbook-generation', {
  concurrency: 3, // 并发处理3个剧本生成任务
})
export class PlaybookGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(PlaybookGenerationProcessor.name)

  constructor(
    private readonly aiAnalysisService: AIAnalysisService,
    private readonly rawContentService: RawContentService,
    private readonly analyzedContentService: AnalyzedContentService,
    @InjectRepository(RadarPush)
    private readonly radarPushRepository: Repository<RadarPush>,
  ) {
    super()
  }

  /**
   * 处理剧本生成任务
   */
  async process(job: Job<PlaybookGenerationJobData>): Promise<void> {
    const { contentId, analyzedContentId } = job.data

    this.logger.log(
      `开始生成合规剧本: contentId=${contentId}, analyzedContentId=${analyzedContentId}`,
    )

    try {
      // 1. 加载数据
      const rawContent = await this.rawContentService.findById(contentId)
      if (!rawContent) {
        throw new Error(`RawContent not found: ${contentId}`)
      }

      const analyzedContent =
        await this.analyzedContentService.findById(analyzedContentId)
      if (!analyzedContent) {
        throw new Error(`AnalyzedContent not found: ${analyzedContentId}`)
      }

      // 2. 查找关联的RadarPush
      const radarPush = await this.radarPushRepository.findOne({
        where: { contentId },
      })

      if (!radarPush) {
        this.logger.warn(
          `RadarPush not found for contentId=${contentId}, skipping playbook generation`,
        )
        return
      }

      // 3. 更新状态为generating
      await this.updatePlaybookStatus(contentId, 'generating')

      try {
        // 4. 调用AI生成剧本
        await this.aiAnalysisService.generateCompliancePlaybook(
          analyzedContent,
          rawContent,
        )

        // 5. 更新状态为ready
        await this.updatePlaybookStatus(contentId, 'ready')
      } catch (error) {
        // 生成失败，更新状态为failed
        await this.updatePlaybookStatus(contentId, 'failed')
        throw error
      }

      this.logger.log(
        `合规剧本生成成功: contentId=${contentId}, pushId=${radarPush.id}`,
      )
    } catch (error) {
      this.logger.error(
        `合规剧本生成失败: contentId=${contentId}`,
        error.stack,
      )

      // 不抛出错误，避免无限重试
      // (错误已在内部处理，状态已更新为failed)
    }
  }

  /**
   * 更新剧本状态
   */
  private async updatePlaybookStatus(
    contentId: string,
    status: 'ready' | 'generating' | 'failed',
  ): Promise<void> {
    try {
      await this.radarPushRepository.update({ contentId }, { playbookStatus: status })
    } catch (error) {
      this.logger.error(
        `更新RadarPush playbookStatus失败: contentId=${contentId}, status=${status}`,
        error.stack,
      )
      throw error
    }
  }

  /**
   * 任务完成事件
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<PlaybookGenerationJobData>) {
    const { contentId } = job.data
    this.logger.log(`剧本生成任务完成: contentId=${contentId}`)
  }

  /**
   * 任务失败事件
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<PlaybookGenerationJobData>, error: Error) {
    const { contentId } = job.data
    this.logger.error(
      `剧本生成任务失败: contentId=${contentId}`,
      error.stack,
    )
  }
}

/**
 * 剧本生成任务数据
 */
export interface PlaybookGenerationJobData {
  contentId: string // RawContent ID
  analyzedContentId: string // AnalyzedContent ID
}
