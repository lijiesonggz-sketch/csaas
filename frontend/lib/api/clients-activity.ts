/**
 * Clients Activity API Client
 *
 * Story 7.3: 客户管理与流失风险预警
 *
 * 提供客户活跃度追踪和流失风险管理的API调用
 */

import { apiFetch } from '../utils/api'

/**
 * 活动状态枚举
 */
export enum ActivityStatus {
  HIGH_ACTIVE = 'high_active',
  MEDIUM_ACTIVE = 'medium_active',
  LOW_ACTIVE = 'low_active',
  CHURN_RISK = 'churn_risk',
}

/**
 * 客户活动数据
 */
export interface ClientActivity {
  organizationId: string
  name: string
  contactEmail?: string
  contactPerson?: string
  monthlyActivityRate: number
  activityStatus: ActivityStatus
  lastActiveAt?: string
  activeDaysLast30: number
  loginActivityRate: number
  contentActivityRate: number
  actionActivityRate: number
  churnRiskFactors: string[]
}

/**
 * 活动趋势数据
 */
export interface ActivityTrend {
  date: string
  rate: number
}

/**
 * 活动细分数据
 */
export interface ActivityBreakdown {
  loginDays: number
  pushViewDays: number
  feedbackDays: number
}

/**
 * 干预记录
 */
export interface Intervention {
  id: string
  organizationId: string
  interventionType: 'contact' | 'survey' | 'training' | 'config_adjustment'
  result: 'contacted' | 'resolved' | 'churned' | 'pending'
  notes?: string
  createdAt: string
  createdBy: string
}

/**
 * 创建干预数据
 */
export interface CreateInterventionData {
  interventionType: 'contact' | 'survey' | 'training' | 'config_adjustment'
  result: 'contacted' | 'resolved' | 'churned' | 'pending'
  notes?: string
}

/**
 * 客户细分数据
 */
export interface ClientSegment {
  name: string
  label: string
  range: string
  count: number
  percentage: number
  targetPercentage?: number
  status?: string
}

/**
 * 客户活动列表响应
 */
export interface ClientActivityListResponse {
  data: ClientActivity[]
  meta: {
    total: number
    highActive: number
    mediumActive: number
    lowActive: number
  }
}

/**
 * 客户活动详情响应
 */
export interface ClientActivityDetailsResponse {
  organizationId: string
  monthlyActivityRate: number
  activityTrend: ActivityTrend[]
  activityBreakdown: ActivityBreakdown
  interventionHistory: Intervention[]
}

/**
 * 客户细分响应
 */
export interface ClientSegmentationResponse {
  segments: ClientSegment[]
  totalCustomers: number
  averageActivityRate: number
}

/**
 * 干预建议
 */
export interface InterventionSuggestion {
  type: 'contact' | 'survey' | 'training' | 'config_adjustment'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

/**
 * 获取客户活动列表
 */
export async function getClientActivityList(params?: {
  status?: string
  sort?: string
  order?: 'asc' | 'desc'
}): Promise<ClientActivityListResponse> {
  const queryParams = new URLSearchParams()
  if (params?.status) queryParams.append('status', params.status)
  if (params?.sort) queryParams.append('sort', params.sort)
  if (params?.order) queryParams.append('order', params.order)

  const query = queryParams.toString()
  return apiFetch(
    `/api/v1/admin/clients/activity${query ? `?${query}` : ''}`,
    {
      method: 'GET',
    }
  ) as Promise<ClientActivityListResponse>
}

/**
 * 获取单个客户活动详情
 */
export async function getClientActivityDetails(
  organizationId: string
): Promise<ClientActivityDetailsResponse> {
  return apiFetch<ClientActivityDetailsResponse>(
    `/api/v1/admin/clients/${organizationId}/activity`,
    {
      method: 'GET',
    }
  )
}

/**
 * 获取流失风险客户列表
 */
export async function getChurnRiskClients(): Promise<ClientActivityListResponse> {
  return apiFetch<ClientActivityListResponse>('/api/v1/admin/clients/churn-risk', {
    method: 'GET',
  })
}

/**
 * 获取客户细分统计
 */
export async function getClientSegmentation(): Promise<ClientSegmentationResponse> {
  return apiFetch<ClientSegmentationResponse>('/api/v1/admin/clients/segmentation', {
    method: 'GET',
  })
}

/**
 * 创建干预记录
 */
export async function createIntervention(
  organizationId: string,
  data: CreateInterventionData
): Promise<Intervention> {
  return apiFetch<Intervention>(`/api/v1/admin/clients/${organizationId}/interventions`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 获取干预历史
 */
export async function getInterventionHistory(organizationId: string): Promise<Intervention[]> {
  return apiFetch<Intervention[]>(`/api/v1/admin/clients/${organizationId}/interventions`, {
    method: 'GET',
  })
}

/**
 * 获取干预建议
 */
export async function getInterventionSuggestions(
  organizationId: string
): Promise<InterventionSuggestion[]> {
  return apiFetch<InterventionSuggestion[]>(
    `/api/v1/admin/clients/${organizationId}/intervention-suggestions`,
    {
      method: 'GET',
    }
  )
}

/**
 * 手动触发活动率计算
 */
export async function calculateActivityRate(organizationId: string): Promise<{
  monthlyRate: number
  loginRate: number
  contentRate: number
  actionRate: number
  status: string
}> {
  return apiFetch<{ monthlyRate: number; loginRate: number; contentRate: number; actionRate: number; status: string }>(
    `/api/v1/admin/clients/${organizationId}/calculate-activity`,
    {
      method: 'POST',
    }
  )
}

/**
 * 活动状态标签映射
 */
export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  [ActivityStatus.HIGH_ACTIVE]: '高活跃',
  [ActivityStatus.MEDIUM_ACTIVE]: '中活跃',
  [ActivityStatus.LOW_ACTIVE]: '低活跃',
  [ActivityStatus.CHURN_RISK]: '流失风险',
}

/**
 * 活动状态颜色映射
 */
export const ACTIVITY_STATUS_COLORS: Record<
  ActivityStatus,
  'success' | 'warning' | 'error' | 'default'
> = {
  [ActivityStatus.HIGH_ACTIVE]: 'success',
  [ActivityStatus.MEDIUM_ACTIVE]: 'warning',
  [ActivityStatus.LOW_ACTIVE]: 'error',
  [ActivityStatus.CHURN_RISK]: 'error',
}

/**
 * 干预类型标签映射
 */
export const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  contact: '联系客户',
  survey: '发送调研',
  training: '提供培训',
  config_adjustment: '配置调整',
}

/**
 * 干预结果标签映射
 */
export const INTERVENTION_RESULT_LABELS: Record<string, string> = {
  contacted: '已联系',
  resolved: '已解决',
  churned: '已流失',
  pending: '待处理',
}
