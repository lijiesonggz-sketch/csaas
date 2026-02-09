/**
 * Peer Crawler Health API Client
 *
 * Story 8.5: 爬虫健康度监控与告警
 *
 * 提供爬虫健康度监控的API调用
 */

import { apiFetch } from '../utils/api'

/**
 * 爬虫健康度数据
 */
export interface CrawlerHealth {
  overallStatus: 'healthy' | 'warning' | 'critical'
  sources: {
    total: number
    active: number
    inactive: number
  }
  recentTasks: {
    completed: number
    failed: number
    pending: number
  }
  last24h: {
    crawlCount: number
    successRate: number
    newContentCount: number
  }
}

/**
 * 爬虫统计数据
 */
export interface CrawlerStats {
  successRateTrend: { date: string; rate: number }[]
  sourceComparison: { peerName: string; success: number; failed: number }[]
  contentTypeDistribution: { type: string; count: number }[]
}

/**
 * 采集任务
 */
export interface CrawlerTask {
  id: string
  sourceId: string
  peerName: string
  tenantId: string
  sourceType: 'website' | 'wechat' | 'recruitment' | 'conference'
  targetUrl: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  crawlResult: any
  rawContentId: string | null
  retryCount: number
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

/**
 * 任务列表响应
 */
export interface CrawlerTasksResponse {
  success: boolean
  data: CrawlerTask[]
  total: number
}

/**
 * 健康度响应
 */
export interface CrawlerHealthResponse {
  success: boolean
  data: CrawlerHealth
}

/**
 * 统计响应
 */
export interface CrawlerStatsResponse {
  success: boolean
  data: CrawlerStats
}

/**
 * 获取爬虫健康度
 */
export async function getCrawlerHealth(): Promise<CrawlerHealthResponse> {
  return apiFetch('/api/admin/peer-crawler/health')
}

/**
 * 获取采集任务列表
 */
export async function getCrawlerTasks(filters?: {
  status?: 'pending' | 'running' | 'completed' | 'failed'
  peerName?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}): Promise<CrawlerTasksResponse> {
  const params = new URLSearchParams()

  if (filters?.status) params.append('status', filters.status)
  if (filters?.peerName) params.append('peerName', filters.peerName)
  if (filters?.startDate) params.append('startDate', filters.startDate)
  if (filters?.endDate) params.append('endDate', filters.endDate)
  if (filters?.limit) params.append('limit', filters.limit.toString())
  if (filters?.offset !== undefined) params.append('offset', filters.offset.toString())

  return apiFetch(`/api/admin/peer-crawler/tasks?${params.toString()}`)
}

/**
 * 获取采集统计
 */
export async function getCrawlerStats(days?: number): Promise<CrawlerStatsResponse> {
  const params = new URLSearchParams()
  if (days) params.append('days', days.toString())

  return apiFetch(`/api/admin/peer-crawler/stats?${params.toString()}`)
}
