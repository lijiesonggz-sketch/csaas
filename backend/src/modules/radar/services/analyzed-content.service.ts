import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AnalyzedContent, ROIAnalysisData } from '../../../database/entities/analyzed-content.entity'
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
    roiAnalysis: ROIAnalysisData | null
    relevanceScore: number | null
    // 行业雷达特定字段 (Story 3.2)
    practiceDescription?: string | null
    estimatedCost?: string | null
    implementationPeriod?: string | null
    technicalEffect?: string | null
    aiModel: string
    tokensUsed: number
    status: 'pending' | 'success' | 'failed'
    errorMessage?: string | null
    analyzedAt: Date
  }): Promise<AnalyzedContent> {
    this.logger.log(`Creating AnalyzedContent for contentId: ${data.contentId}`)

    // 验证ROI分析数据（如果提供）
    if (data.roiAnalysis) {
      this.validateROIAnalysis(data.roiAnalysis)
    }

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

  /**
   * 更新 AnalyzedContent 记录 (Story 2.4)
   *
   * @param id - AnalyzedContent ID
   * @param data - 要更新的数据
   */
  async update(
    id: string,
    data: Partial<{
      roiAnalysis: ROIAnalysisData
      relevanceScore: number
      status: 'pending' | 'success' | 'failed'
      errorMessage: string
    }>,
  ): Promise<void> {
    // 验证ROI分析数据（如果提供）
    if (data.roiAnalysis) {
      this.validateROIAnalysis(data.roiAnalysis)
    }

    await this.analyzedContentRepo.update(id, data)
    this.logger.log(`AnalyzedContent ${id} updated`)
  }

  /**
   * 验证ROI分析数据结构 (Story 2.4 - Issue #4修复)
   *
   * @param roi - ROI分析数据
   * @throws Error 如果数据结构不完整
   */
  private validateROIAnalysis(roi: any): asserts roi is ROIAnalysisData {
    const required = [
      'estimatedCost',
      'expectedBenefit',
      'roiEstimate',
      'implementationPeriod',
      'recommendedVendors',
    ]

    for (const field of required) {
      if (!(field in roi)) {
        throw new Error(`ROI analysis missing required field: ${field}`)
      }
    }

    // 验证recommendedVendors是数组
    if (!Array.isArray(roi.recommendedVendors)) {
      throw new Error('ROI analysis recommendedVendors must be an array')
    }

    // 验证字符串字段不为空
    const stringFields = ['estimatedCost', 'expectedBenefit', 'roiEstimate', 'implementationPeriod']
    for (const field of stringFields) {
      if (typeof roi[field] !== 'string' || roi[field].trim() === '') {
        throw new Error(`ROI analysis ${field} must be a non-empty string`)
      }
    }
  }
}
