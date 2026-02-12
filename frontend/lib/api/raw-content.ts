/**
 * RawContent API 封装
 *
 * Story 8.3: 文件导入状态管理界面
 *
 * 用于管理文件导入的原始内容
 */

import { apiFetch } from '@/lib/utils/api'

/**
 * RawContent 状态类型
 */
export type RawContentStatus = 'pending' | 'analyzing' | 'analyzed' | 'failed'

/**
 * RawContent 分类类型
 */
export type RawContentCategory = 'tech' | 'industry' | 'compliance'

/**
 * RawContent 来源类型
 */
export type RawContentSource = 'website' | 'wechat'

/**
 * RawContent 数据模型
 */
export interface RawContent {
  id: string
  title: string
  author?: string | null
  source: RawContentSource
  category: RawContentCategory
  status: RawContentStatus
  originalUrl?: string | null
  sourceName?: string | null
  errorMessage?: string
  fullContent?: string | null
  createdAt: string
  updatedAt: string
}

/**
 * RawContent 统计数据
 */
export interface RawContentStats {
  pending: number
  analyzing: number
  analyzed: number
  failed: number
  todayImported: number
}

/**
 * 分页响应数据
 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

/**
 * 获取RawContent列表参数
 */
export interface GetRawContentsParams {
  page?: number
  limit?: number
  status?: RawContentStatus | 'all'
  category?: RawContentCategory | 'all'
  source?: RawContentSource | 'all'
  keyword?: string
  organizationId?: string
}

/**
 * 获取RawContent列表
 * @param params 查询参数
 * @returns 分页的RawContent列表
 */
export async function getRawContents(
  params: GetRawContentsParams = {},
): Promise<PaginatedResponse<RawContent>> {
  const queryParams = new URLSearchParams()

  if (params.page) queryParams.append('page', params.page.toString())
  if (params.limit) queryParams.append('limit', params.limit.toString())
  if (params.status && params.status !== 'all') queryParams.append('status', params.status)
  if (params.category && params.category !== 'all') queryParams.append('category', params.category)
  if (params.source && params.source !== 'all') queryParams.append('source', params.source)
  if (params.keyword) queryParams.append('keyword', params.keyword)
  if (params.organizationId) queryParams.append('organizationId', params.organizationId)

  const queryString = queryParams.toString()
  const endpoint = `/api/admin/raw-contents${queryString ? `?${queryString}` : ''}`

  return apiFetch(endpoint)
}

/**
 * 获取RawContent统计数据
 * Story 8.3
 * @returns 统计数据
 */
export async function getRawContentStats(): Promise<RawContentStats> {
  return apiFetch('/api/admin/raw-contents/stats')
}

/**
 * 获取单条RawContent详情
 * Story 8.3
 * @param id RawContent ID
 * @returns RawContent详情
 */
export async function getRawContentById(id: string): Promise<RawContent> {
  return apiFetch(`/api/admin/raw-contents/${id}`)
}

/**
 * 重新触发RawContent分析
 * Story 8.3
 * @param id RawContent ID
 * @returns 成功消息
 */
export async function reanalyzeRawContent(id: string): Promise<{ message: string }> {
  return apiFetch(`/api/admin/raw-contents/${id}/reanalyze`, {
    method: 'POST',
  })
}

/**
 * 删除RawContent
 * Story 8.3
 * @param id RawContent ID
 */
export async function deleteRawContent(id: string): Promise<void> {
  return apiFetch(`/api/admin/raw-contents/${id}`, {
    method: 'DELETE',
  })
}
