/**
 * RawContent DTOs
 *
 * Story 8.3: 文件导入状态管理界面
 *
 * 定义 RawContent 相关的数据传输对象
 */

import { IsString, IsEnum, IsOptional, IsNumber, IsUUID, Min, Max, IsInt } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * 内容状态枚举
 */
export enum RawContentStatus {
  PENDING = 'pending',
  ANALYZING = 'analyzing',
  ANALYZED = 'analyzed',
  FAILED = 'failed',
}

/**
 * 内容分类枚举
 */
export enum RawContentCategory {
  TECH = 'tech',
  INDUSTRY = 'industry',
  COMPLIANCE = 'compliance',
}

/**
 * 内容来源枚举
 */
export enum RawContentSource {
  WEBSITE = 'website',
  WECHAT = 'wechat',
}

/**
 * QueryRawContentDto
 *
 * Story 8.3: 查询原始内容的参数验证
 */
export class QueryRawContentDto {
  @ApiPropertyOptional({ description: '状态筛选', enum: RawContentStatus })
  @IsOptional()
  @IsEnum(RawContentStatus)
  status?: RawContentStatus

  @ApiPropertyOptional({ description: '分类筛选', enum: RawContentCategory })
  @IsOptional()
  @IsEnum(RawContentCategory)
  category?: RawContentCategory

  @ApiPropertyOptional({ description: '来源筛选', enum: RawContentSource })
  @IsOptional()
  @IsEnum(RawContentSource)
  source?: RawContentSource

  @ApiPropertyOptional({ description: '组织ID筛选' })
  @IsOptional()
  @IsUUID()
  organizationId?: string

  @ApiPropertyOptional({ description: '搜索关键词（标题）' })
  @IsOptional()
  @IsString()
  keyword?: string

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20
}

/**
 * RawContent 列表响应项
 * Story 8.3
 */
export class RawContentListItemDto {
  @ApiProperty({ description: '内容ID' })
  id: string

  @ApiProperty({ description: '标题' })
  title: string

  @ApiPropertyOptional({ description: '作者' })
  author?: string

  @ApiProperty({ description: '来源', enum: RawContentSource })
  source: RawContentSource

  @ApiProperty({ description: '分类', enum: RawContentCategory })
  category: RawContentCategory

  @ApiProperty({ description: '状态', enum: RawContentStatus })
  status: RawContentStatus

  @ApiPropertyOptional({ description: '原始URL' })
  originalUrl?: string

  @ApiPropertyOptional({ description: '来源名称' })
  sourceName?: string

  @ApiProperty({ description: '创建时间' })
  createdAt: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date
}

/**
 * RawContent 列表响应 DTO
 * Story 8.3
 */
export class RawContentListResponseDto {
  @ApiProperty({ description: '数据列表', type: [RawContentListItemDto] })
  data: RawContentListItemDto[]

  @ApiProperty({ description: '总数' })
  total: number

  @ApiProperty({ description: '当前页' })
  page: number

  @ApiProperty({ description: '每页数量' })
  limit: number
}

/**
 * RawContentStatsDto
 *
 * Story 8.3: 原始内容统计响应
 */
export class RawContentStatsDto {
  @ApiProperty({ description: '待分析数量' })
  pending: number

  @ApiProperty({ description: '分析中数量' })
  analyzing: number

  @ApiProperty({ description: '已分析数量' })
  analyzed: number

  @ApiProperty({ description: '失败数量' })
  failed: number

  @ApiProperty({ description: '今日导入数量' })
  todayImported: number
}

/**
 * RawContent 详情响应 DTO
 * Story 8.3
 */
export class RawContentDetailDto {
  @ApiProperty({ description: '内容ID' })
  id: string

  @ApiProperty({ description: '标题' })
  title: string

  @ApiPropertyOptional({ description: '作者' })
  author?: string

  @ApiPropertyOptional({ description: '发布日期' })
  publishDate?: Date

  @ApiProperty({ description: '来源', enum: RawContentSource })
  source: RawContentSource

  @ApiProperty({ description: '分类', enum: RawContentCategory })
  category: RawContentCategory

  @ApiProperty({ description: '状态', enum: RawContentStatus })
  status: RawContentStatus

  @ApiPropertyOptional({ description: '原始URL' })
  originalUrl?: string

  @ApiPropertyOptional({ description: '来源名称' })
  sourceName?: string

  @ApiPropertyOptional({ description: '原始内容' })
  rawContent?: string

  @ApiPropertyOptional({ description: '分析结果' })
  analysisResult?: any

  @ApiPropertyOptional({ description: 'AI生成内容ID' })
  generatedContentId?: string

  @ApiPropertyOptional({ description: '组织ID' })
  organizationId?: string

  @ApiPropertyOptional({ description: '错误信息' })
  errorMessage?: string

  @ApiProperty({ description: '创建时间' })
  createdAt: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date

  // AI分析结果字段
  @ApiPropertyOptional({ description: 'AI摘要' })
  aiSummary?: string

  @ApiPropertyOptional({ description: 'AI分析状态' })
  aiAnalysisStatus?: 'pending' | 'success' | 'failed'

  @ApiPropertyOptional({ description: '使用的AI模型' })
  aiModel?: string

  @ApiPropertyOptional({ description: '关键词' })
  keywords?: string[]

  @ApiPropertyOptional({ description: '技术分类' })
  categories?: string[]

  @ApiPropertyOptional({ description: '目标受众' })
  targetAudience?: string

  @ApiPropertyOptional({ description: '合规分析结果' })
  complianceAnalysis?: {
    complianceRiskCategory?: string
    penaltyCase?: string
    policyRequirements?: string
    remediationSuggestions?: string
    relatedWeaknessCategories?: string[]
  }

  @ApiPropertyOptional({ description: 'ROI分析结果' })
  roiAnalysis?: {
    estimatedCost: string
    expectedBenefit: string
    roiEstimate: string
    implementationPeriod: string
    recommendedVendors: string[]
  }
}
