import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'

/**
 * DTO for get push history query
 */
class GetPushHistoryDto {
  page?: number
  limit?: number
  radarType?: 'tech' | 'industry' | 'compliance'
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
    const { page = 1, limit = 20, radarType, status } = query

    // 构建查询条件（暂时不使用组织过滤用于测试）
    const where: any = {}

    if (radarType) {
      where.radarType = radarType
    }

    if (status) {
      where.status = status
    }

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

    return {
      data: pushes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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

    return push
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
