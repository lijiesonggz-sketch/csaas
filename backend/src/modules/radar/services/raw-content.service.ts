import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
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
    const contentHash = this.generateContentHash(
      data.title,
      data.url || '',
      data.publishDate,
    )

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
  private generateContentHash(
    title: string,
    url: string,
    publishDate: Date | null,
  ): string {
    const content = `${title}${url}${publishDate}`
    return createHash('sha256').update(content).digest('hex')
  }
}
