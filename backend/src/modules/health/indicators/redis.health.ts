import { Injectable } from '@nestjs/common'
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { AI_TASK_QUEUE } from '../../ai-tasks/constants/queue.constants'

/**
 * Redis健康检查指标
 * 通过BullMQ队列检查Redis连接状态
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    @InjectQueue(AI_TASK_QUEUE)
    private readonly queue: Queue,
  ) {
    super()
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // 尝试从Redis获取队列信息
      const client = await this.queue.client

      // 执行PING命令
      const pong = await client.ping()

      if (pong === 'PONG') {
        const queueStats = {
          waiting: await this.queue.getWaitingCount(),
          active: await this.queue.getActiveCount(),
          completed: await this.queue.getCompletedCount(),
          failed: await this.queue.getFailedCount(),
        }

        return this.getStatus(key, true, {
          status: 'connected',
          response: pong,
          queue: queueStats,
        })
      }

      throw new Error('Redis ping failed')
    } catch (error) {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, {
          error: error.message,
          status: 'disconnected',
        }),
      )
    }
  }
}
