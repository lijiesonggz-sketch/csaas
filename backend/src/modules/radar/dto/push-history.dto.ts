import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsString,
  IsBoolean,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator'
import { Type } from 'class-transformer'

/**
 * QueryPushHistoryDto - 推送历史查询参数
 *
 * Story 5.4: 推送历史查看 - Task 1.1
 *
 * 支持多维度筛选：
 * - 雷达类型（tech/industry/compliance）
 * - 时间范围（7d/30d/90d/all 或自定义日期）
 * - 相关性级别（high/medium/low/all）
 * - 关键词搜索（预留，MVP不实现）
 * - 分页参数
 */
export class QueryPushHistoryDto {
  /**
   * 雷达类型筛选
   * - tech: 技术雷达
   * - industry: 行业雷达
   * - compliance: 合规雷达
   */
  @IsOptional()
  @IsEnum(['tech', 'industry', 'compliance'])
  radarType?: 'tech' | 'industry' | 'compliance'

  /**
   * 推送状态筛选
   * - scheduled: 已调度
   * - sent: 已发送
   * - failed: 推送失败
   */
  @IsOptional()
  @IsEnum(['scheduled', 'sent', 'failed'])
  status?: 'scheduled' | 'sent' | 'failed'

  /**
   * 时间范围快捷选项
   * - 7d: 最近7天
   * - 30d: 最近30天
   * - 90d: 最近90天
   * - all: 全部时间
   */
  @IsOptional()
  @IsEnum(['7d', '30d', '90d', 'all'])
  timeRange?: '7d' | '30d' | '90d' | 'all'

  /**
   * 自定义开始日期（ISO 8601格式）
   * 当timeRange为自定义时使用
   */
  @IsOptional()
  @IsDateString()
  startDate?: string

  /**
   * 自定义结束日期（ISO 8601格式）
   * 当timeRange为自定义时使用
   */
  @IsOptional()
  @IsDateString()
  endDate?: string

  /**
   * 相关性级别筛选
   * - high: 高相关（relevanceScore >= 0.9）
   * - medium: 中相关（0.7 <= relevanceScore < 0.9）
   * - low: 低相关（relevanceScore < 0.7）
   * - all: 全部相关性
   */
  @IsOptional()
  @IsEnum(['high', 'medium', 'low', 'all'])
  relevance?: 'high' | 'medium' | 'low' | 'all'

  /**
   * 关键词搜索（预留字段，MVP不实现）
   * 用于全文搜索推送标题和摘要
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string

  /**
   * 前端兼容字段：organizationId 允许显式透传，但服务层会以当前组织为准
   */
  @IsOptional()
  @IsString()
  organizationId?: string

  /**
   * 前端兼容字段：额外筛选标记（保留，MVP 不在 service 层处理复杂业务）
   */
  @IsOptional()
  @IsString()
  filter?: string

  /**
   * 是否已读筛选
   */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isRead?: boolean

  /**
   * 页码（从1开始）
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1

  /**
   * 每页记录数（1-50）
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 20
}

/**
 * PushHistoryItemDto - 推送历史列表项
 *
 * Story 5.4: 推送历史查看 - Task 1.1
 */
export class PushHistoryItemDto {
  /** 推送记录ID */
  id: string

  /** 雷达类型 */
  radarType: 'tech' | 'industry' | 'compliance'

  /** 推送标题 */
  title: string

  /** 推送摘要 */
  summary: string

  /** 相关性评分（0.00-1.00） */
  relevanceScore: number

  /** 相关性级别 */
  relevanceLevel: 'high' | 'medium' | 'low'

  /** 推送时间 */
  sentAt: string

  /** 阅读时间 */
  readAt: string | null

  /** 是否已读 */
  isRead: boolean

  /** 是否已收藏 */
  isBookmarked: boolean

  /** 信息来源名称 */
  sourceName?: string

  /** 信息来源URL */
  sourceUrl?: string

  /** 关联薄弱项类别 */
  weaknessCategories?: string[]

  /** ROI评分（技术雷达特有） */
  roiScore?: number

  /** 同业机构名称（行业雷达特有） */
  peerName?: string

  /** 风险级别（合规雷达特有） */
  riskLevel?: 'high' | 'medium' | 'low'

  /** 匹配的关注同业机构列表（行业雷达） */
  matchedPeers?: string[]

  /** 统一控制点上下文字段 */
  controlId: string | null
  matchedControls: Array<{
    controlId: string
    controlName: string
    packSource: string
    priority: string
  }>
  sourceModule: 'radar'
  sourceRecordId: string
  sourceRoute: string
}

/**
 * PushHistoryResponseDto - 推送历史查询响应
 *
 * Story 5.4: 推送历史查看 - Task 1.1
 */
export class PushHistoryResponseDto {
  /** 推送列表数据 */
  data: PushHistoryItemDto[]

  /** 分页元数据 */
  meta: {
    /** 总记录数 */
    total: number
    /** 当前页码 */
    page: number
    /** 每页记录数 */
    limit: number
    /** 总页数 */
    totalPages: number
  }
}

export class UpdatePushBookmarkDto {
  @IsBoolean()
  bookmark: boolean
}
