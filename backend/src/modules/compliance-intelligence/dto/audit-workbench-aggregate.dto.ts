/**
 * 审核工作台聚合查询 DTO
 *
 * 为 Epic 8.1 预留的审核工作台聚合查询响应结构
 * 遵循 Unified Control Context Protocol
 */

import type { AITaskType } from '../../../database/entities/ai-task.entity'
import type {
  ControlContext,
  SourceModule,
} from './unified-control-context.dto'

export type AuditWorkbenchRiskLevel = 'high' | 'medium' | 'low'

export type AuditWorkbenchSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'confidenceLevel'
  | 'reviewStatus'
  | 'riskLevel'
  | 'title'

export type AuditWorkbenchSortOrder = 'asc' | 'desc'

export interface AuditWorkbenchSourcePreviewDto {
  aiExcerpt: string
  sourceExcerpt: string | null
  sourceDocumentName: string | null
  extractionQuality: 'complete' | 'partial' | 'missing'
}

/**
 * 审核工作台聚合查询响应类型
 * 实现 ControlContext 接口以支持后续 7.4 审核抽屉接入
 */
export interface AuditWorkbenchAggregateResponseDto extends ControlContext {
  /** 审核项 ID */
  reviewItemId: string

  /** 来源记录 ID（复用 ControlContext.sourceRecordId） */
  sourceRecordId: string

  /** 来源模块固定为 'audit' */
  sourceModule: Extract<SourceModule, 'audit'>

  /** 来源路由格式 */
  sourceRoute: `/projects/${string}/review`

  /** 审核状态 */
  reviewStatus: string

  /** 置信度 */
  confidenceLevel: string

  /** 一致性分数 */
  consistencyScores: {
    structural: number | null
    semantic: number | null
    detail: number | null
  }

  /** 高风险标记 */
  highRiskFlag: boolean

  /** 是否可重跑 */
  canRerun: boolean
}

export interface AuditWorkbenchListItemDto extends AuditWorkbenchAggregateResponseDto {
  sourceResultId: string
  taskId: string
  taskType: AITaskType
  reviewStage: AITaskType
  title: string
  riskLevel: AuditWorkbenchRiskLevel
  degradationReasons: string[]
  sourcePreview: AuditWorkbenchSourcePreviewDto
  createdAt: string
  updatedAt: string
}

export interface AuditWorkbenchPaginationDto {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface AuditWorkbenchFiltersAppliedDto {
  reviewStatus?: string[]
  riskLevel?: AuditWorkbenchRiskLevel[]
  reviewStage?: AITaskType
  sortBy: AuditWorkbenchSortBy
  sortOrder: AuditWorkbenchSortOrder
}

export interface AuditWorkbenchListResponseDto {
  items: AuditWorkbenchListItemDto[]
  pagination: AuditWorkbenchPaginationDto
  filtersApplied: AuditWorkbenchFiltersAppliedDto
}

/**
 * 创建空的审核上下文引用
 */
export function createEmptyAuditControlContext(): Omit<
  ControlContext,
  'sourceRecordId' | 'sourceModule' | 'sourceRoute'
> & {
  sourceRecordId: string
  sourceModule: Extract<SourceModule, 'audit'>
  sourceRoute: string
} {
  return {
    controlId: null,
    matchedControls: [],
    sourceRecordId: '', // 由调用方设置
    sourceModule: 'audit',
    sourceRoute: '', // 由调用方设置
  }
}

/**
 * 为审核响应添加控制点上下文
 */
export function enrichAuditResponseWithControlContext(
  response: Omit<AuditWorkbenchAggregateResponseDto, keyof ControlContext>,
  projectId: string,
): AuditWorkbenchAggregateResponseDto {
  return {
    ...response,
    controlId: null, // 审核项可能关联多个控制点
    matchedControls: [], // 由调用方根据实际关联填充
    sourceModule: 'audit',
    sourceRecordId: response.reviewItemId,
    sourceRoute: `/projects/${projectId}/review`,
  }
}
