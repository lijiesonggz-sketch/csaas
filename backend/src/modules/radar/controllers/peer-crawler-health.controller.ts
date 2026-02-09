import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../../common/decorators/roles.decorator'
import { UserRole } from '../../../database/entities/user.entity'
import { CrawlerHealthService } from '../services/crawler-health.service'
import { PeerCrawlerTaskRepository } from '../../../database/repositories/peer-crawler-task.repository'

/**
 * CrawlerHealthDto
 * 健康度响应数据
 */
export interface CrawlerHealthDto {
  overallStatus: 'healthy' | 'warning' | 'critical'
  sources: {
    total: number
    active: number
    inactive: number
  }
  recentTasks: {
    completed: number
    failed: number
    pending: number
  }
  last24h: {
    crawlCount: number
    successRate: number
    newContentCount: number
  }
}

/**
 * CrawlerStatsDto
 * 统计响应数据
 */
export interface CrawlerStatsDto {
  successRateTrend: { date: string; rate: number }[]
  sourceComparison: { peerName: string; success: number; failed: number }[]
  contentTypeDistribution: { type: string; count: number }[]
}

/**
 * PeerCrawlerTaskDto
 * 任务列表项
 */
export interface PeerCrawlerTaskDto {
  id: string
  sourceId: string
  peerName: string
  tenantId: string
  sourceType: 'website' | 'wechat' | 'recruitment' | 'conference'
  targetUrl: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  crawlResult: any
  rawContentId: string | null
  retryCount: number
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

/**
 * PeerCrawlerHealthController
 *
 * 同业爬虫健康度管理后台API
 *
 * Story 8.5: 爬虫健康度监控与告警 - Task 3
 */
@ApiTags('Peer Crawler Health')
@Controller('api/admin/peer-crawler')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CONSULTANT)
@ApiBearerAuth()
export class PeerCrawlerHealthController {
  constructor(
    private readonly crawlerHealthService: CrawlerHealthService,
    private readonly peerCrawlerTaskRepository: PeerCrawlerTaskRepository,
  ) {}

  /**
   * 获取爬虫健康度
   * GET /api/admin/peer-crawler/health
   */
  @Get('health')
  @ApiOperation({ summary: '获取爬虫健康度', description: '返回整体健康状态、采集源统计、任务统计和24小时统计' })
  async getHealth(): Promise<{ success: boolean; data: CrawlerHealthDto }> {
    const healthDetails = await this.crawlerHealthService.getHealthDetails()

    return {
      success: true,
      data: healthDetails,
    }
  }

  /**
   * 获取任务列表
   * GET /api/admin/peer-crawler/tasks
   */
  @Get('tasks')
  @ApiOperation({
    summary: '获取采集任务列表',
    description: '支持按状态、同业名称、日期范围筛选',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'running', 'completed', 'failed'] })
  @ApiQuery({ name: 'peerName', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getTasks(
    @Query('status') status?: 'pending' | 'running' | 'completed' | 'failed',
    @Query('peerName') peerName?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ): Promise<{ success: boolean; data: PeerCrawlerTaskDto[]; total: number }> {
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (peerName) {
      where.peerName = peerName
    }

    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate))
    } else if (startDate) {
      where.createdAt = MoreThanOrEqual(new Date(startDate))
    } else if (endDate) {
      where.createdAt = LessThanOrEqual(new Date(endDate))
    }

    const [tasks, total] = await this.peerCrawlerTaskRepository['repository'].findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    })

    const data: PeerCrawlerTaskDto[] = tasks.map((task) => ({
      id: task.id,
      sourceId: task.sourceId,
      peerName: task.peerName,
      tenantId: task.tenantId,
      sourceType: task.sourceType,
      targetUrl: task.targetUrl,
      status: task.status,
      crawlResult: task.crawlResult,
      rawContentId: task.rawContentId,
      retryCount: task.retryCount,
      errorMessage: task.errorMessage,
      startedAt: task.startedAt?.toISOString() || null,
      completedAt: task.completedAt?.toISOString() || null,
      createdAt: task.createdAt.toISOString(),
    }))

    return {
      success: true,
      data,
      total,
    }
  }

  /**
   * 获取采集统计
   * GET /api/admin/peer-crawler/stats
   */
  @Get('stats')
  @ApiOperation({
    summary: '获取采集统计',
    description: '返回成功率趋势、各采集源对比、内容类型分布',
  })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getStats(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days?: number,
  ): Promise<{ success: boolean; data: CrawlerStatsDto }> {
    const stats = await this.crawlerHealthService.getCrawlerStats(days)

    return {
      success: true,
      data: stats,
    }
  }
}
