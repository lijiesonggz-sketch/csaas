import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Between } from 'typeorm'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { createHash } from 'crypto'

/**
 * RawContentService
 *
 * 管理原始内容的CRUD操作
 *
 * Story 2.1: 爬虫和文件导入机制
 */
@Injectable()
export class RawContentService {
  private readonly logger = new Logger(RawContentService.name)

  constructor(
    @InjectRepository(RawContent)
    private readonly rawContentRepository: Repository<RawContent>,
  ) {}

  /**
   * 创建原始内容
   * 自动生成contentHash用于去重
   */
  async create(
    data: Omit<RawContent, 'id' | 'contentHash' | 'status' | 'createdAt' | 'updatedAt'>,
  ): Promise<RawContent> {
    // 生成内容哈希（用于去重）
    const contentHash = this.generateContentHash(data.title, data.url || '', data.publishDate)

    // 检查是否已存在相同内容
    const existing = await this.rawContentRepository.findOne({
      where: { contentHash },
    })

    if (existing) {
      this.logger.log(`Content already exists with hash: ${contentHash}`)
      return existing
    }

    const rawContent = this.rawContentRepository.create({
      ...data,
      contentHash,
      status: 'pending',
    })

    return await this.rawContentRepository.save(rawContent)
  }

  /**
   * 查找所有待分析的内容
   */
  async findPending(): Promise<RawContent[]> {
    return await this.rawContentRepository.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
    })
  }

  /**
   * 更新内容状态
   */
  async updateStatus(
    id: string,
    status: 'pending' | 'analyzing' | 'analyzed' | 'failed',
  ): Promise<void> {
    const result = await this.rawContentRepository.update(id, { status })

    if (result.affected === 0) {
      throw new NotFoundException('Content not found')
    }
  }

  /**
   * 根据ID查找内容
   */
  async findById(id: string): Promise<RawContent | null> {
    return await this.rawContentRepository.findOne({
      where: { id },
    })
  }

  /**
   * 生成内容哈希
   * 使用SHA-256哈希（title + url + publishDate）
   */
  private generateContentHash(title: string, url: string, publishDate: Date | null): string {
    const content = `${title}${url}${publishDate}`
    return createHash('sha256').update(content).digest('hex')
  }

  /**
   * 分页查询原始内容，支持筛选
   *
   * @param filters - 筛选条件
   * @returns 分页结果
   */
  async findWithFilters(filters: {
    status?: 'pending' | 'analyzing' | 'analyzed' | 'failed'
    category?: 'tech' | 'industry' | 'compliance'
    source?: string
    organizationId?: string
    search?: string
    page?: number
    limit?: number
  }): Promise<{ items: RawContent[]; total: number; page: number; limit: number }> {
    const { status, category, source, organizationId, search, page = 1, limit = 20 } = filters

    const queryBuilder = this.rawContentRepository.createQueryBuilder('rawContent')

    // 应用筛选条件
    if (status) {
      queryBuilder.andWhere('rawContent.status = :status', { status })
    }

    if (category) {
      queryBuilder.andWhere('rawContent.category = :category', { category })
    }

    if (source) {
      queryBuilder.andWhere('rawContent.source = :source', { source })
    }

    if (organizationId) {
      queryBuilder.andWhere('rawContent.organizationId = :organizationId', { organizationId })
    }

    // 搜索标题
    if (search) {
      queryBuilder.andWhere('rawContent.title LIKE :search', { search: `%${search}%` })
    }

    // 计算总数
    const total = await queryBuilder.getCount()

    // 分页查询
    const items = await queryBuilder
      .orderBy('rawContent.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany()

    return {
      items,
      total,
      page,
      limit,
    }
  }

  /**
   * 获取统计信息
   *
   * @returns 各状态统计数量和今日导入数量
   */
  async getStats(): Promise<{
    pending: number
    analyzing: number
    analyzed: number
    failed: number
    todayImported: number
  }> {
    // 获取各状态数量
    const [pending, analyzing, analyzed, failed] = await Promise.all([
      this.rawContentRepository.count({ where: { status: 'pending' } }),
      this.rawContentRepository.count({ where: { status: 'analyzing' } }),
      this.rawContentRepository.count({ where: { status: 'analyzed' } }),
      this.rawContentRepository.count({ where: { status: 'failed' } }),
    ])

    // 获取今日导入数量
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayImported = await this.rawContentRepository.count({
      where: {
        createdAt: Between(today, tomorrow),
      },
    })

    return {
      pending,
      analyzing,
      analyzed,
      failed,
      todayImported,
    }
  }

  /**
   * 重新触发AI分析
   * 将状态重置为pending
   *
   * @param id - 内容ID
   * @returns 更新后的内容
   */
  async reanalyze(id: string): Promise<RawContent> {
    const content = await this.findById(id)

    if (!content) {
      throw new NotFoundException(`Raw content with id ${id} not found`)
    }

    // 重置状态为pending
    await this.rawContentRepository.update(id, { status: 'pending' })

    // 返回更新后的内容
    const updated = await this.findById(id)
    if (!updated) {
      throw new NotFoundException(`Raw content with id ${id} not found after update`)
    }

    return updated
  }

  /**
   * 删除原始内容
   *
   * @param id - 内容ID
   */
  async delete(id: string): Promise<void> {
    const result = await this.rawContentRepository.delete(id)

    if (result.affected === 0) {
      throw new NotFoundException(`Raw content with id ${id} not found`)
    }
  }
}
