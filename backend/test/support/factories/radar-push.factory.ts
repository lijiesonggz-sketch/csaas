import { DataSource } from 'typeorm'
import { RadarPush } from '../../../src/database/entities/radar-push.entity'
import { AnalyzedContent } from '../../../src/database/entities/analyzed-content.entity'
import { RawContent } from '../../../src/database/entities/raw-content.entity'
import { Tag } from '../../../src/database/entities/tag.entity'

/**
 * RadarPush Factory
 *
 * 用于创建测试用的RadarPush记录
 * 支持自定义覆盖和自动清理
 */

export interface CreateRadarPushOptions {
  organizationId: string
  radarType?: 'tech' | 'industry' | 'compliance'
  relevanceScore?: number
  priorityLevel?: 'high' | 'medium' | 'low'
  status?: 'scheduled' | 'sent' | 'failed'
  scheduledAt?: Date
  sentAt?: Date
  contentId?: string
  createContent?: boolean
}

export class RadarPushFactory {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 创建RadarPush记录
   *
   * @param options - 配置选项
   * @returns RadarPush实体
   */
  async create(options: CreateRadarPushOptions): Promise<RadarPush> {
    const {
      organizationId,
      radarType = 'tech',
      relevanceScore = 0.95,
      priorityLevel = 'high',
      status = 'scheduled',
      scheduledAt = new Date(),
      sentAt,
      contentId,
      createContent = true,
    } = options

    // 如果需要创建内容
    let finalContentId = contentId
    if (createContent && !contentId) {
      const content = await this.createTestContent(
        `Test Content ${Date.now()}`,
        ['数据安全'],
        ['测试标签'],
      )
      finalContentId = content.id
    }

    const push = this.dataSource.getRepository(RadarPush).create({
      organizationId,
      radarType,
      contentId: finalContentId,
      relevanceScore,
      priorityLevel,
      status,
      scheduledAt,
      sentAt,
    })

    return this.dataSource.getRepository(RadarPush).save(push)
  }

  /**
   * 批量创建RadarPush记录
   *
   * @param count - 数量
   * @param options - 配置选项
   * @returns RadarPush实体数组
   */
  async createMany(count: number, options: CreateRadarPushOptions): Promise<RadarPush[]> {
    const pushes: RadarPush[] = []

    for (let i = 0; i < count; i++) {
      const push = await this.create({
        ...options,
        relevanceScore: options.relevanceScore || 0.9 + i * 0.01,
      })
      pushes.push(push)
    }

    return pushes
  }

  /**
   * 创建测试内容
   *
   * @param title - 标题
   * @param categories - 分类
   * @param tags - 标签
   * @returns AnalyzedContent实体
   */
  private async createTestContent(
    title: string,
    categories: string[],
    tags: string[],
  ): Promise<AnalyzedContent> {
    // 创建RawContent
    const rawContent = this.dataSource.getRepository(RawContent).create({
      title,
      url: `https://example.com/${Date.now()}`,
      source: 'TEST',
      category: 'tech',
      publishDate: new Date(),
    })
    await this.dataSource.getRepository(RawContent).save(rawContent)

    // 创建Tags
    const tagEntities = []
    for (const tagName of tags) {
      const tag = this.dataSource.getRepository(Tag).create({
        name: tagName,
        category: null,
      })
      await this.dataSource.getRepository(Tag).save(tag)
      tagEntities.push(tag)
    }

    // 创建AnalyzedContent
    const analyzedContent = this.dataSource.getRepository(AnalyzedContent).create({
      contentId: rawContent.id,
      status: 'success',
      categories,
      tags: tagEntities,
      aiSummary: `Summary of ${title}`,
      targetAudience: 'CTO',
      rawContent,
    })
    await this.dataSource.getRepository(AnalyzedContent).save(analyzedContent)

    return analyzedContent
  }

  /**
   * 清理测试数据
   *
   * @param organizationId - 组织ID
   */
  async cleanup(organizationId: string): Promise<void> {
    await this.dataSource.getRepository(RadarPush).delete({ organizationId })
  }

  /**
   * 清理所有测试数据
   */
  async cleanupAll(): Promise<void> {
    await this.dataSource.getRepository(RadarPush).delete({})
    await this.dataSource.getRepository(AnalyzedContent).delete({})
    await this.dataSource.getRepository(Tag).delete({})
    await this.dataSource.getRepository(RawContent).delete({})
  }
}
