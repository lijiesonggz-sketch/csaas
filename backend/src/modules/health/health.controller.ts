import { Controller, Get } from '@nestjs/common'
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus'
import { RedisHealthIndicator } from './indicators/redis.health'

/**
 * Health Check控制器
 * 用于监控系统各组件健康状态
 */
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  /**
   * 基础健康检查
   * GET /health
   */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // 数据库连接检查
      () => this.db.pingCheck('database'),

      // Redis连接检查
      () => this.redis.isHealthy('redis'),

      // 内存使用检查（不超过300MB）
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),

      // RSS内存检查（不超过500MB）
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),

      // 磁盘空间检查（至少保留50%可用空间）
      () =>
        this.disk.checkStorage('disk', {
          path: process.platform === 'win32' ? 'C:\\' : '/',
          thresholdPercent: 0.5,
        }),
    ])
  }

  /**
   * 详细健康检查
   * GET /health/detailed
   */
  @Get('detailed')
  @HealthCheck()
  detailedCheck() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),
      () =>
        this.disk.checkStorage('disk', {
          path: process.platform === 'win32' ? 'C:\\' : '/',
          thresholdPercent: 0.5,
        }),
    ])
  }

  /**
   * 数据库健康检查
   * GET /health/db
   */
  @Get('db')
  @HealthCheck()
  checkDatabase() {
    return this.health.check([() => this.db.pingCheck('database')])
  }

  /**
   * Redis健康检查
   * GET /health/redis
   */
  @Get('redis')
  @HealthCheck()
  checkRedis() {
    return this.health.check([() => this.redis.isHealthy('redis')])
  }
}
