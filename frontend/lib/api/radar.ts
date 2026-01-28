/**
 * Radar API Client (Story 2.4 - Issue #2修复)
 *
 * 提供技术雷达推送相关的API调用
 */

import { apiFetch } from '../utils/api'

/**
 * ROI分析数据结构
 */
export interface ROIAnalysis {
  estimatedCost: string
  expectedBenefit: string
  roiEstimate: string
  implementationPeriod: string
  recommendedVendors: string[]
}

/**
 * 推送数据结构
 */
export interface RadarPush {
  pushId: string
  radarType: 'tech' | 'industry' | 'compliance'
  title: string
  summary: string
  fullContent?: string
  relevanceScore: number
  priorityLevel: 1 | 2 | 3
  weaknessCategories: string[]
  url: string
  publishDate: string
  source: string
  tags: string[]
  targetAudience: string
  roiAnalysis?: ROIAnalysis
  isRead: boolean
  readAt?: string
}

/**
 * 推送列表响应
 */
export interface RadarPushesResponse {
  data: RadarPush[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * 获取推送列表
 *
 * @param filters - 筛选条件
 * @returns 推送列表
 */
export async function getRadarPushes(filters?: {
  radarType?: 'tech' | 'industry' | 'compliance'
  status?: 'scheduled' | 'sent' | 'failed'
  isRead?: boolean
  page?: number
  limit?: number
}): Promise<RadarPushesResponse> {
  const params = new URLSearchParams()

  if (filters?.radarType) params.append('radarType', filters.radarType)
  if (filters?.status) params.append('status', filters.status)
  if (filters?.isRead !== undefined) params.append('isRead', String(filters.isRead))
  if (filters?.page) params.append('page', String(filters.page))
  if (filters?.limit) params.append('limit', String(filters.limit))

  // apiFetch 现在返回解析后的数据，不再需要 .ok 检查和 .json()
  const data = await apiFetch(`/api/radar/pushes?${params.toString()}`)

  console.log('[getRadarPushes] API返回数据:', data)

  return data
}

/**
 * 获取单个推送详情
 *
 * @param pushId - 推送ID
 * @returns 推送详情
 */
export async function getRadarPush(pushId: string): Promise<RadarPush> {
  // apiFetch 现在返回解析后的数据
  const data = await apiFetch(`/api/radar/pushes/${pushId}`)

  return data
}

/**
 * 标记推送为已读
 *
 * @param pushId - 推送ID
 */
export async function markPushAsRead(pushId: string): Promise<void> {
  const response = await apiFetch(`/api/radar/pushes/${pushId}/read`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Failed to mark push as read: ${response.statusText}`)
  }
}
