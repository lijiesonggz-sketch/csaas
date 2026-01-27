import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Tag } from '../../../database/entities/tag.entity'

/**
 * TagService - 标签管理服务
 *
 * Story 2.2: AI 分析时自动提取并创建标签
 *
 * 核心功能：
 * - findByName: 通过名称查找标签
 * - findOrCreate: 查找或创建标签（AI 分析时使用）
 * - incrementUsageCount: 增加标签使用计数
 * - getPopularTags: 获取热门标签
 */
@Injectable()
export class TagService {
  private readonly logger = new Logger(TagService.name)

  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {}

  /**
   * 通过名称查找标签
   * @param name - 标签名称
   * @returns Tag 或 null
   */
  async findByName(name: string): Promise<Tag | null> {
    return this.tagRepository.findOne({
      where: { name },
    })
  }

  /**
   * 查找或创建标签
   * AI 分析时如果标签不存在则自动创建
   *
   * @param name - 标签名称
   * @param tagType - 标签类型
   * @param category - 标签分类（可选）
   * @returns Tag
   */
  async findOrCreate(
    name: string,
    tagType: 'tech' | 'peer' | 'compliance' | 'vendor' | 'custom',
    category?: string,
  ): Promise<Tag> {
    // 1. 先查找
    let tag = await this.findByName(name)

    // 2. 如果不存在则创建
    if (!tag) {
      tag = this.tagRepository.create({
        name,
        tagType,
        category,
        usageCount: 0,
        watchCount: 0,
        isActive: true,
        isVerified: false, // AI 创建的标签默认未审核
        isOfficial: false,
      })

      tag = await this.tagRepository.save(tag)
      this.logger.log(`Created new tag: ${name} (${tagType})`)
    }

    return tag
  }

  /**
   * 批量查找或创建标签
   * @param tags - 标签数据数组
   * @returns Tag[]
   */
  async findOrCreateMany(
    tags: Array<{
      name: string
      tagType: 'tech' | 'peer' | 'compliance' | 'vendor' | 'custom'
      category?: string
    }>,
  ): Promise<Tag[]> {
    const results: Tag[] = []

    for (const tagData of tags) {
      const tag = await this.findOrCreate(
        tagData.name,
        tagData.tagType,
        tagData.category,
      )
      results.push(tag)
    }

    return results
  }

  /**
   * 增加标签使用计数
   * @param tagId - 标签 ID
   */
  async incrementUsageCount(tagId: string): Promise<void> {
    await this.tagRepository.increment({ id: tagId }, 'usageCount', 1)
  }

  /**
   * 批量增加标签使用计数
   * @param tagIds - 标签 ID 数组
   */
  async incrementUsageCountBatch(tagIds: string[]): Promise<void> {
    for (const tagId of tagIds) {
      await this.incrementUsageCount(tagId)
    }
  }

  /**
   * 获取热门标签
   * @param limit - 返回数量限制
   * @param tagType - 标签类型筛选（可选）
   * @returns Tag[]
   */
  async getPopularTags(
    limit: number = 20,
    tagType?: 'tech' | 'peer' | 'compliance' | 'vendor' | 'custom',
  ): Promise<Tag[]> {
    const query = this.tagRepository
      .createQueryBuilder('tag')
      .where('tag.isActive = :isActive', { isActive: true })
      .orderBy('tag.usageCount', 'DESC')
      .limit(limit)

    if (tagType) {
      query.andWhere('tag.tagType = :tagType', { tagType })
    }

    return query.getMany()
  }

  /**
   * 通过 ID 查找标签
   * @param id - 标签 ID
   * @returns Tag 或 null
   */
  async findById(id: string): Promise<Tag | null> {
    return this.tagRepository.findOne({
      where: { id },
    })
  }

  /**
   * 批量通过 ID 查找标签
   * @param ids - 标签 ID 数组
   * @returns Tag[]
   */
  async findByIds(ids: string[]): Promise<Tag[]> {
    return this.tagRepository.findByIds(ids)
  }
}
