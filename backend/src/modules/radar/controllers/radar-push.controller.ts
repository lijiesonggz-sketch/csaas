import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In } from 'typeorm'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { OrganizationGuard } from '../../organizations/guards/organization.guard'
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { CurrentOrg } from '../../organizations/decorators/current-org.decorator'
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

  @IsOptional()
  @IsString()
  organizationId?: string

  @IsOptional()
  @IsString()
  filter?: string
}

/**
 * RadarPushController - 推送历史查询API
 *
 * Story 2.3: 推送系统与调度 - Phase 3 Task 3.4
 * Story 6.1A: 多租户数据模型与 API/服务层隔离 - Phase 2
 * Story 6.1B: 数据库层 RLS 与审计层 - Phase 2
 *
 * API端点：
 * - GET /api/radar/pushes - 查询推送历史（分页）
 * - GET /api/radar/pushes/:id - 获取推送详情
 * - PATCH /api/radar/pushes/:id/read - 标记推送已读
 *
 * 权限：
 * - 需要JWT认证
 * - 需要租户验证（TenantGuard）- 多租户隔离（tenantId 自动注入到 request）
 * - 审计拦截器（AuditInterceptor）- 记录所有敏感操作
 */
@Controller('api/radar/pushes')
@UseGuards(JwtAuthGuard, TenantGuard, OrganizationGuard)
@UseInterceptors(AuditInterceptor)
export class RadarPushController {
  private readonly logger = new Logger(RadarPushController.name)

  constructor(
    @InjectRepository(RadarPush)
    private readonly radarPushRepo: Repository<RadarPush>,
    @InjectRepository(AnalyzedContent)
    private readonly analyzedContentRepo: Repository<AnalyzedContent>,
    @InjectRepository(RawContent)
    private readonly rawContentRepo: Repository<RawContent>,
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
   * - 多租户隔离：自动过滤当前租户的数据
   *
   * @param tenantId - 租户ID（由TenantGuard自动注入）
   * @param organizationId - 组织ID（由OrganizationGuard自动注入）
   * @param query - 查询参数
   */
  @Get()
  async getPushHistory(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() currentOrg: { organizationId: string; userId: string },
    @Query() query: GetPushHistoryDto,
  ) {
    try {
      const { page = 1, limit = 20, radarType, status, organizationId: queryOrgId } = query
      const organizationId = queryOrgId || currentOrg.organizationId

      this.logger.log(`getPushHistory called with:`, { tenantId, page, limit, radarType, status, organizationId })

      // 构建查询条件 - 必须包含 tenantId 进行多租户隔离
      const where: any = {
        tenantId, // ✅ 添加 tenantId 过滤（Layer 2 防御）
      }

      if (radarType) {
        where.radarType = radarType
      }

      if (status) {
        where.status = status
      }

      // 添加组织过滤（如果提供了organizationId）
      if (organizationId) {
        where.organizationId = organizationId
      }

      this.logger.log(`Query conditions:`, where)

      // 分页查询 - 先查询推送记录
      const [pushes, total] = await this.radarPushRepo.findAndCount({
        where,
        order: {
          priorityLevel: 'DESC',
          relevanceScore: 'DESC',
          scheduledAt: 'DESC',
        },
        skip: (page - 1) * limit,
        take: limit,
      })

      this.logger.log(`Found ${pushes.length} pushes, total: ${total}`)

      // 获取所有 contentId 并查询关联数据
      const contentIds = pushes.map(p => p.contentId).filter(Boolean)
      const analyzedContents = contentIds.length > 0
        ? await this.analyzedContentRepo.find({
            where: { id: In(contentIds) },
            relations: ['tags'],
          })
        : []
      const analyzedMap = new Map(analyzedContents.map(a => [a.id, a]))

      const rawContentIds = analyzedContents.map(a => a.contentId).filter(Boolean)
      const rawContents = rawContentIds.length > 0
        ? await this.rawContentRepo.find({
            where: { id: In(rawContentIds) },
          })
        : []
      const rawMap = new Map(rawContents.map(r => [r.id, r]))

      // Transform database entities to frontend response format
      const transformedPushes = pushes.map(push => {
        const analyzed = analyzedMap.get(push.contentId)
        const raw = analyzed ? rawMap.get(analyzed.contentId) : null

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
      this.logger.error('Error in getPushHistory:', error.stack || error)
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
   * - 多租户隔离：自动过滤当前租户的数据
   *
   * @param tenantId - 租户ID（由TenantGuard自动注入）
   * @param id - 推送记录ID
   */
  @Get(':id')
  async getPushDetail(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const push = await this.radarPushRepo.findOne({
      where: { id, tenantId }, // ✅ 添加 tenantId 过滤（Layer 2 防御）
    })

    if (!push) {
      throw new NotFoundException('Push not found')
    }

    // 单独查询关联数据
    const analyzed = push.contentId
      ? await this.analyzedContentRepo.findOne({
          where: { id: push.contentId },
          relations: ['tags'],
        })
      : null
    const raw = analyzed?.contentId
      ? await this.rawContentRepo.findOne({
          where: { id: analyzed.contentId },
        })
      : null

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
   * - 多租户隔离：自动过滤当前租户的数据
   *
   * 注意：当前 RadarPush 实体没有 isRead/readAt 字段
   * 这些字段应该在 Story 5.4 中添加（完整的推送管理功能）
   *
   * @param tenantId - 租户ID（由TenantGuard自动注入）
   * @param id - 推送记录ID
   */
  @Patch(':id/read')
  async markAsRead(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const push = await this.radarPushRepo.findOne({
      where: { id, tenantId }, // ✅ 添加 tenantId 过滤（Layer 2 防御）
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
