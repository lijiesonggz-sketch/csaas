import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { IsOptional, IsNumber, IsString, IsEnum, IsInt, Min } from 'class-validator'
import { Type } from 'class-transformer'

/**
 * DTO for get push history query
 */
class GetPushHistoryDto {
  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number

  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number

  @IsOptional()
  @IsString()
  @IsEnum(['tech', 'industry', 'compliance'])
  radarType?: 'tech' | 'industry' | 'compliance'

  @IsOptional()
  @IsString()
  @IsEnum(['scheduled', 'sent', 'failed'])
  status?: 'scheduled' | 'sent' | 'failed'
}

/**
 * RadarPushController - 推送历史查询API
 *
 * Story 2.3: 推送系统与调度 - Phase 3 Task 3.4
 *
 * API端点：
 * - GET /api/radar/pushes - 查询推送历史（分页）
 * - GET /api/radar/pushes/:id - 获取推送详情
 * - PATCH /api/radar/pushes/:id/read - 标记推送已读
 *
 * 权限：
 * - 需要JWT认证
 * - 暂时禁用组织权限验证以避免循环依赖
 */
@Controller('api/radar/pushes')
@UseGuards(JwtAuthGuard) // 暂时只使用JWT认证
export class RadarPushController {
  private readonly logger = new Logger(RadarPushController.name)

  constructor(
    @InjectRepository(RadarPush)
    private readonly radarPushRepo: Repository<RadarPush>,
  ) {}

  /**
   * 查询推送历史
   *
   * GET /api/radar/pushes?page=1&limit=20&radarType=tech&status=sent
   *
   * AC 8: 推送历史查询API
   * - 支持分页查询
   * - 支持按雷达类型、状态筛选
   * - 按优先级、相关性评分、推送时间降序排序
   *
   * @param query - 查询参数
   */
  @Get()
  async getPushHistory(
    @Query() query: GetPushHistoryDto,
  ) {
    try {
      const { page = 1, limit = 20, radarType, status } = query

      this.logger.log(`getPushHistory called with:`, { page, limit, radarType, status })

      // 构建查询条件（暂时不使用组织过滤用于测试）
      const where: any = {}

      if (radarType) {
        where.radarType = radarType
      }

      if (status) {
        where.status = status
      }

      this.logger.log(`Query conditions:`, where)

      // 分页查询
      const [pushes, total] = await this.radarPushRepo.findAndCount({
        where,
        order: {
          priorityLevel: 'DESC',
          relevanceScore: 'DESC',
          scheduledAt: 'DESC',
        },
        skip: (page - 1) * limit,
        take: limit,
        relations: ['analyzedContent', 'analyzedContent.rawContent', 'analyzedContent.tags'],
      })

      this.logger.log(`Found ${pushes.length} pushes, total: ${total}`)

      // Transform database entities to frontend response format
      const transformedPushes = pushes.map(push => {
        const analyzed = push.analyzedContent
        const raw = analyzed?.rawContent

        // Transform priority level from string to number
        const priorityMap: Record<string, 1 | 2 | 3> = {
          'high': 1,
          'medium': 2,
          'low': 3,
        }

        return {
          pushId: push.id,
          radarType: push.radarType,
          title: raw?.title || '',
          summary: analyzed?.aiSummary || raw?.summary || '',
          fullContent: raw?.fullContent,
          relevanceScore: parseFloat(push.relevanceScore as any) || 0,
          priorityLevel: priorityMap[push.priorityLevel] || 3,
          weaknessCategories: analyzed?.categories || [],
          url: raw?.url || '',
          publishDate: raw?.publishDate || push.scheduledAt,
          source: raw?.source || '',
          tags: analyzed?.tags?.map((t: any) => t.name) || [],
          targetAudience: analyzed?.targetAudience || '',
          roiAnalysis: analyzed?.roiAnalysis || undefined,
          isRead: push.isRead || false,
          readAt: push.readAt,
        }
      })

      return {
        data: transformedPushes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      this.logger.error('Error in getPushHistory:', error)
      throw error
    }
  }

  /**
   * 获取推送详情
   *
   * GET /api/radar/pushes/:id
   *
   * AC 8: 推送历史查询API
   * - 返回完整的推送信息，包括关联的内容和标签
   *
   * @param id - 推送记录ID
   */
  @Get(':id')
  async getPushDetail(
    @Param('id') id: string,
  ) {
    const push = await this.radarPushRepo.findOne({
      where: { id },
      relations: [
        'analyzedContent',
        'analyzedContent.rawContent',
        'analyzedContent.tags',
      ],
    })

    if (!push) {
      throw new NotFoundException('Push not found')
    }

    // Transform database entity to frontend response format
    const analyzed = push.analyzedContent
    const raw = analyzed?.rawContent

    // Transform priority level from string to number
    const priorityMap: Record<string, 1 | 2 | 3> = {
      'high': 1,
      'medium': 2,
      'low': 3,
    }

    return {
      pushId: push.id,
      radarType: push.radarType,
      title: raw?.title || '',
      summary: analyzed?.aiSummary || raw?.summary || '',
      fullContent: raw?.fullContent,
      relevanceScore: parseFloat(push.relevanceScore as any) || 0,
      priorityLevel: priorityMap[push.priorityLevel] || 3,
      weaknessCategories: analyzed?.categories || [],
      url: raw?.url || '',
      publishDate: raw?.publishDate || push.scheduledAt,
      source: raw?.source || '',
      tags: analyzed?.tags?.map((t: any) => t.name) || [],
      targetAudience: analyzed?.targetAudience || '',
      roiAnalysis: analyzed?.roiAnalysis || undefined,
      isRead: push.isRead || false,
      readAt: push.readAt,
    }
  }

  /**
   * 标记推送已读
   *
   * PATCH /api/radar/pushes/:id/read
   *
   * AC 8: 推送历史查询API
   * - 更新 isRead=true（如果实体有该字段）
   * - 记录 readAt 时间戳（如果实体有该字段）
   *
   * 注意：当前 RadarPush 实体没有 isRead/readAt 字段
   * 这些字段应该在 Story 5.4 中添加（完整的推送管理功能）
   *
   * @param id - 推送记录ID
   */
  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
  ) {
    const push = await this.radarPushRepo.findOne({
      where: { id },
    })

    if (!push) {
      throw new NotFoundException('Push not found')
    }

    // TODO: Story 5.4 将添加 isRead 和 readAt 字段
    // await this.radarPushRepo.update(id, {
    //   isRead: true,
    //   readAt: new Date(),
    // })

    return { success: true, message: 'Mark as read functionality will be implemented in Story 5.4' }
  }
}
