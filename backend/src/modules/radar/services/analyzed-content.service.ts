import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { Tag } from '../../../database/entities/tag.entity'

/**
 * AnalyzedContentService - AI 分析结果管理服务
 *
 * Story 2.2: 管理 AI 分析后的结构化数据
 *
 * 核心功能：
 * - create: 创建 AI 分析结果记录
 * - findByContentId: 通过原始内容 ID 查找分析结果
 * - findPending: 查找待分析的内容
 * - updateStatus: 更新分析状态
 */
@Injectable()
export class AnalyzedContentService {
  private readonly logger = new Logger(AnalyzedContentService.name)

  constructor(
    @InjectRepository(AnalyzedContent)
    private readonly analyzedContentRepo: Repository<AnalyzedContent>,
  ) {}

  /**
   * 创建 AI 分析结果记录
   *
   * @param data - 分析结果数据
   * @returns 创建的 AnalyzedContent 记录
   */
  async create(data: {
    contentId: string
    tags: Tag[]
    keywords: string[]
    categories: string[]
    targetAudience: string | null
    aiSummary: string | null
    roiAnalysis: any | null
    relevanceScore: number | null
    aiModel: string
    tokensUsed: number
    status: 'pending' | 'success' | 'failed'
    errorMessage?: string | null
    analyzedAt: Date
  }): Promise<AnalyzedContent> {
    this.logger.log(`Creating AnalyzedContent for contentId: ${data.contentId}`)

    const analyzedContent = this.analyzedContentRepo.create({
      ...data,
    })

    // 保存并关联标签
    const saved = await this.analyzedContentRepo.save(analyzedContent)

    // 建立标签关联
    if (data.tags.length > 0) {
      saved.tags = data.tags
      await this.analyzedContentRepo.save(saved)
    }

    this.logger.log(
      `AnalyzedContent created: ${saved.id}, tags: ${data.tags.length}, status: ${saved.status}`,
    )

    return saved
  }

  /**
   * 通过原始内容 ID 查找分析结果
   *
   * @param contentId - 原始内容 ID
   * @returns AnalyzedContent 记录或 null
   */
  async findByContentId(contentId: string): Promise<AnalyzedContent | null> {
    return this.analyzedContentRepo.findOne({
      where: { contentId },
      relations: ['tags', 'rawContent'],
    })
  }

  /**
   * 查找待分析的内容（状态为 pending）
   *
   * @param limit - 限制返回数量
   * @returns AnalyzedContent 记录数组
   */
  async findPending(limit = 10): Promise<AnalyzedContent[]> {
    return this.analyzedContentRepo.find({
      where: { status: 'pending' },
      take: limit,
      order: { createdAt: 'ASC' },
    })
  }

  /**
   * 更新分析状态
   *
   * @param id - AnalyzedContent ID
   * @param status - 新状态
   * @param errorMessage - 错误信息（可选）
   */
  async updateStatus(
    id: string,
    status: 'pending' | 'success' | 'failed',
    errorMessage?: string,
  ): Promise<void> {
    await this.analyzedContentRepo.update(id, {
      status,
      errorMessage: errorMessage || null,
    })

    this.logger.log(`AnalyzedContent ${id} status updated to: ${status}`)
  }

  /**
   * 通过 ID 查找 AnalyzedContent
   *
   * @param id - AnalyzedContent ID
   * @returns AnalyzedContent 记录或 null
   */
  async findById(id: string): Promise<AnalyzedContent | null> {
    return this.analyzedContentRepo.findOne({
      where: { id },
      relations: ['tags', 'rawContent'],
    })
  }
}
