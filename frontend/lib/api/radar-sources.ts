/**
 * Radar Sources API Client
 *
 * Story 3.1: 配置行业雷达信息源
 *
 * 提供雷达信息源配置管理的API调用
 */

import { apiFetch } from '../utils/api'

/**
 * CrawlConfig 选择器配置
 * Story 8.1: 同业采集源管理
 */
export interface CrawlConfig {
  selector?: string
  listSelector?: string
  titleSelector?: string
  contentSelector?: string
  dateSelector?: string
  authorSelector?: string
  paginationPattern?: string
  maxPages?: number
}

/**
 * 雷达信息源数据结构
 */
export interface RadarSource {
  id: string
  source: string
  category: 'tech' | 'industry' | 'compliance'
  url: string
  type: 'wechat' | 'recruitment' | 'conference' | 'website'
  peerName?: string
  isActive: boolean
  crawlSchedule: string
  lastCrawledAt?: string
  lastCrawlStatus: 'pending' | 'success' | 'failed'
  lastCrawlError?: string
  crawlConfig?: CrawlConfig
  createdAt: string
  updatedAt: string
}

/**
 * 创建信息源的数据
 */
export interface CreateRadarSourceData {
  source: string
  category: 'tech' | 'industry' | 'compliance'
  url: string
  type: 'wechat' | 'recruitment' | 'conference' | 'website'
  peerName?: string
  isActive?: boolean
  crawlSchedule?: string
  crawlConfig?: CrawlConfig
}

/**
 * 更新信息源的数据
 */
export interface UpdateRadarSourceData {
  source?: string
  url?: string
  type?: 'wechat' | 'recruitment' | 'conference' | 'website'
  peerName?: string
  isActive?: boolean
  crawlSchedule?: string
  crawlConfig?: CrawlConfig
}

/**
 * 信息源列表响应
 */
export interface RadarSourcesResponse {
  success: boolean
  data: RadarSource[]
  total: number
}

/**
 * 单个信息源响应
 */
export interface RadarSourceResponse {
  success: boolean
  data: RadarSource
  message?: string
}

/**
 * 统计数据响应
 */
export interface RadarSourceStatsResponse {
  success: boolean
  data: {
    tech: {
      total: number
      active: number
      inactive: number
    }
    industry: {
      total: number
      active: number
      inactive: number
    }
    compliance: {
      total: number
      active: number
      inactive: number
    }
  }
}

/**
 * 获取所有信息源
 *
 * @param filters - 筛选条件
 * @returns 信息源列表
 */
export async function getRadarSources(filters?: {
  category?: 'tech' | 'industry' | 'compliance'
  isActive?: boolean
}): Promise<RadarSourcesResponse> {
  const params = new URLSearchParams()

  if (filters?.category) params.append('category', filters.category)
  if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive))

  const data = await apiFetch(`/api/admin/radar-sources?${params.toString()}`)

  // apiFetch 已经自动提取了 data，所以这里需要重新包装
  return {
    success: true,
    data: data,
    total: data.length,
  }
}

/**
 * 获取单个信息源
 *
 * @param id - 信息源ID
 * @returns 信息源详情
 */
export async function getRadarSource(id: string): Promise<RadarSourceResponse> {
  const data = await apiFetch(`/api/admin/radar-sources/${id}`)

  return data
}

/**
 * 创建新的信息源
 *
 * @param data - 创建数据
 * @returns 创建的信息源
 */
export async function createRadarSource(
  data: CreateRadarSourceData,
): Promise<RadarSourceResponse> {
  const response = await apiFetch('/api/admin/radar-sources', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  return response
}

/**
 * 更新信息源
 *
 * @param id - 信息源ID
 * @param data - 更新数据
 * @returns 更新后的信息源
 */
export async function updateRadarSource(
  id: string,
  data: UpdateRadarSourceData,
): Promise<RadarSourceResponse> {
  const response = await apiFetch(`/api/admin/radar-sources/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  return response
}

/**
 * 删除信息源
 *
 * @param id - 信息源ID
 */
export async function deleteRadarSource(id: string): Promise<void> {
  await apiFetch(`/api/admin/radar-sources/${id}`, {
    method: 'DELETE',
  })
}

/**
 * 切换信息源启用状态
 *
 * @param id - 信息源ID
 * @returns 更新后的信息源
 */
export async function toggleRadarSourceActive(
  id: string,
): Promise<RadarSourceResponse> {
  const response = await apiFetch(`/api/admin/radar-sources/${id}/toggle`, {
    method: 'PATCH',
  })

  return response
}

/**
 * 测试爬虫
 *
 * @param id - 信息源ID
 * @returns 测试结果
 */
export async function testRadarSourceCrawl(id: string): Promise<any> {
  const response = await apiFetch(`/api/admin/radar-sources/${id}/test-crawl`, {
    method: 'POST',
  })

  return response
}

/**
 * 获取按类别分组的统计数据
 *
 * @returns 统计数据
 */
export async function getRadarSourceStats(): Promise<RadarSourceStatsResponse> {
  const data = await apiFetch('/api/admin/radar-sources/stats/by-category')

  return data
}
