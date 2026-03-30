import { apiFetch } from '@/lib/utils/api'
import { AIGenerationAPI } from '@/lib/api/ai-generation'
import { ProjectsAPI } from '@/lib/api/projects'
import type { GenerationResult } from '@/lib/types/ai-generation'

export type ProjectReviewStatus = 'pending' | 'approved' | 'modified' | 'rejected'
export type ProjectReviewRiskLevel = 'high' | 'medium' | 'low'
export type ProjectReviewStage =
  | 'summary'
  | 'clustering'
  | 'matrix'
  | 'questionnaire'
  | 'action_plan'
  | 'standard_interpretation'
  | 'standard_related_search'
  | 'standard_version_compare'
  | 'binary_questionnaire'
  | 'binary_gap_analysis'
  | 'quick_gap_analysis'

export interface ProjectReviewQuery {
  page?: number
  pageSize?: number
  reviewStatus?: ProjectReviewStatus[]
  riskLevel?: ProjectReviewRiskLevel[]
  reviewStage?: ProjectReviewStage
  sortBy?: 'createdAt' | 'updatedAt' | 'confidenceLevel' | 'reviewStatus' | 'riskLevel' | 'title'
  sortOrder?: 'asc' | 'desc'
}

export interface ProjectReviewItem {
  reviewItemId: string
  sourceResultId: string
  taskId: string
  taskType: ProjectReviewStage
  reviewStage: ProjectReviewStage
  title: string
  reviewStatus: ProjectReviewStatus
  confidenceLevel: string
  consistencyScores: {
    structural: number | null
    semantic: number | null
    detail: number | null
  }
  highRiskFlag: boolean
  canRerun: boolean
  sourceModule: 'audit'
  sourceRecordId: string
  sourceRoute: string
  riskLevel: ProjectReviewRiskLevel
  degradationReasons: string[]
  matchedControls: Array<{
    controlId: string
    controlName: string
    packSource: string
    priority: string
  }>
  controlId: string | null
  sourcePreview: {
    aiExcerpt: string
    sourceExcerpt: string | null
    sourceDocumentName: string | null
    extractionQuality: 'complete' | 'partial' | 'missing'
  }
  createdAt: string
  updatedAt: string
}

export interface ProjectReviewListResponse {
  items: ProjectReviewItem[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  filtersApplied: {
    reviewStatus?: ProjectReviewStatus[]
    riskLevel?: ProjectReviewRiskLevel[]
    reviewStage?: ProjectReviewStage
    sortBy: ProjectReviewQuery['sortBy']
    sortOrder: ProjectReviewQuery['sortOrder']
  }
}

export type ProjectReviewDecision = 'accept' | 'modify' | 'reject'

export interface SubmitProjectReviewDecisionInput {
  reviewItemId: string
  decision: ProjectReviewDecision
  reviewedBy: string
  originalResult?: Record<string, unknown>
  modifiedPatch?: Record<string, unknown>
  reason?: string
}

export interface RerunProjectReviewItemResult {
  status: 'queued' | 'retry-later'
  message: string
}

function appendArrayParam(params: URLSearchParams, key: string, values?: string[]) {
  values?.forEach((value) => params.append(key, value))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeJsonPatch(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch
  }

  const next: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    const current = next[key]
    next[key] =
      isPlainObject(current) && isPlainObject(value)
        ? mergeJsonPatch(current, value)
        : value
  }
  return next
}

function mapReviewStageToRerunType(
  reviewStage: ProjectReviewStage,
): 'summary' | 'clustering' | 'matrix' | 'questionnaire' | 'action_plan' | null {
  switch (reviewStage) {
    case 'summary':
    case 'clustering':
    case 'matrix':
    case 'questionnaire':
    case 'action_plan':
      return reviewStage
    default:
      return null
  }
}

export async function getProjectReviewItems(
  projectId: string,
  query: ProjectReviewQuery = {},
): Promise<ProjectReviewListResponse> {
  const params = new URLSearchParams()

  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  appendArrayParam(params, 'reviewStatus', query.reviewStatus)
  appendArrayParam(params, 'riskLevel', query.riskLevel)
  if (query.reviewStage) params.set('reviewStage', query.reviewStage)
  if (query.sortBy) params.set('sortBy', query.sortBy)
  if (query.sortOrder) params.set('sortOrder', query.sortOrder)

  const queryString = params.toString()
  return apiFetch(
    `/projects/${projectId}/review-items${queryString ? `?${queryString}` : ''}`,
  )
}

export async function getProjectReviewResult(taskId: string): Promise<GenerationResult> {
  const response = await AIGenerationAPI.getResult(taskId)
  return response.data
}

export async function submitProjectReviewDecision(
  input: SubmitProjectReviewDecisionInput,
): Promise<void> {
  const reviewStatus =
    input.decision === 'accept'
      ? 'APPROVED'
      : input.decision === 'modify'
        ? 'MODIFIED'
        : 'REJECTED'

  const modifiedResult =
    input.decision === 'modify' && input.modifiedPatch
      ? (mergeJsonPatch(
          input.originalResult ?? {},
          input.modifiedPatch,
        ) as Record<string, unknown>)
      : undefined

  await AIGenerationAPI.updateReviewStatus(
    input.reviewItemId,
    reviewStatus,
    input.reviewedBy,
    modifiedResult,
    input.reason,
  )
}

export async function rerunProjectReviewItem(input: {
  projectId: string
  reviewItemId: string
  reviewStage: ProjectReviewStage
  reason?: string
}): Promise<RerunProjectReviewItemResult> {
  if (!input.reviewItemId.trim()) {
    return {
      status: 'retry-later',
      message: '缺少审核项标识，当前无法发起重跑',
    }
  }

  const taskType = mapReviewStageToRerunType(input.reviewStage)

  if (!taskType) {
    return {
      status: 'retry-later',
      message: '当前审核项暂不支持重跑，请稍后再试',
    }
  }

  try {
    await ProjectsAPI.rerunTask(input.projectId, {
      type: taskType,
    })

    return {
      status: 'queued',
      message: '已加入重跑队列',
    }
  } catch (error) {
    return {
      status: 'retry-later',
      message: error instanceof Error ? error.message : '当前无法重跑，请稍后再试',
    }
  }
}
