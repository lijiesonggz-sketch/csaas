import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, FindManyOptions } from 'typeorm'
import { PeerCrawlerTask } from '../entities/peer-crawler-task.entity'

/**
 * PeerCrawlerTaskRepository
 *
 * 同业采集任务的数据访问层
 *
 * Story 8.2: 同业采集任务调度与执行
 */
@Injectable()
export class PeerCrawlerTaskRepository {
  constructor(
    @InjectRepository(PeerCrawlerTask)
    private readonly repository: Repository<PeerCrawlerTask>,
  ) {}

  /**
   * 创建新的采集任务
   */
  async create(data: {
    sourceId: string
    peerName: string
    tenantId: string
    sourceType: 'website' | 'wechat' | 'recruitment' | 'conference'
    targetUrl: string
    status?: 'pending' | 'running' | 'completed' | 'failed'
  }): Promise<PeerCrawlerTask> {
    const task = this.repository.create({
      ...data,
      status: data.status || 'pending',
      retryCount: 0,
    })
    return await this.repository.save(task)
  }

  /**
   * 根据ID查找任务
   */
  async findById(id: string): Promise<PeerCrawlerTask | null> {
    return await this.repository.findOne({
      where: { id },
    })
  }

  /**
   * 查询待处理的任务
   */
  async findPendingTasks(tenantId?: string): Promise<PeerCrawlerTask[]> {
    const where: any = { status: 'pending' }
    if (tenantId) {
      where.tenantId = tenantId
    }
    return await this.repository.find({
      where,
      order: { createdAt: 'ASC' },
    })
  }

  /**
   * 按采集源查询任务
   */
  async findTasksBySourceId(
    sourceId: string,
    options?: FindManyOptions<PeerCrawlerTask>,
  ): Promise<PeerCrawlerTask[]> {
    // 正确合并 where 条件
    const baseWhere = { sourceId }
    let mergedWhere: any = baseWhere

    if (options?.where) {
      if (typeof options.where === 'object' && !Array.isArray(options.where)) {
        mergedWhere = { ...options.where, ...baseWhere }
      }
      // 如果是数组或其他复杂类型，只使用 baseWhere
    }

    return await this.repository.find({
      ...options,
      where: mergedWhere,
    })
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(
    id: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    result?: {
      crawlResult?: PeerCrawlerTask['crawlResult']
      rawContentId?: string
      errorMessage?: string
      retryCount?: number
    },
  ): Promise<PeerCrawlerTask | null> {
    const updateData: any = { status }

    if (status === 'running') {
      updateData.startedAt = new Date()
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date()
    }

    if (result) {
      if (result.crawlResult !== undefined) {
        updateData.crawlResult = result.crawlResult
      }
      if (result.rawContentId !== undefined) {
        updateData.rawContentId = result.rawContentId
      }
      if (result.errorMessage !== undefined) {
        updateData.errorMessage = result.errorMessage
      }
      if (result.retryCount !== undefined) {
        updateData.retryCount = result.retryCount
      }
    }

    await this.repository.update(id, updateData)
    return this.findById(id)
  }

  /**
   * 增加重试次数
   */
  async incrementRetryCount(id: string): Promise<void> {
    await this.repository.increment({ id }, 'retryCount', 1)
  }

  /**
   * 查询最近失败的任务
   */
  async findRecentFailedTasks(
    sourceId: string,
    limit: number = 3,
  ): Promise<PeerCrawlerTask[]> {
    return await this.repository.find({
      where: { sourceId, status: 'failed' },
      order: { createdAt: 'DESC' },
      take: limit,
    })
  }

  /**
   * 统计任务数量
   */
  async countTasks(
    tenantId: string,
    filters?: {
      status?: 'pending' | 'running' | 'completed' | 'failed'
      sourceId?: string
    },
  ): Promise<number> {
    const where: any = { tenantId }
    if (filters?.status) {
      where.status = filters.status
    }
    if (filters?.sourceId) {
      where.sourceId = filters.sourceId
    }
    return await this.repository.count({ where })
  }

  /**
   * 获取任务的执行时长统计
   */
  async getAverageExecutionTime(sourceId: string): Promise<number> {
    const tasks = await this.repository.find({
      where: { sourceId, status: 'completed' },
      select: ['startedAt', 'completedAt'],
    })

    if (tasks.length === 0) {
      return 0
    }

    const validTasks = tasks.filter((task) => task.startedAt && task.completedAt)

    if (validTasks.length === 0) {
      return 0
    }

    const totalDuration = validTasks.reduce((sum, task) => {
      return sum + (task.completedAt!.getTime() - task.startedAt!.getTime())
    }, 0)

    return Math.round(totalDuration / validTasks.length / 1000) // 返回秒数
  }
}
