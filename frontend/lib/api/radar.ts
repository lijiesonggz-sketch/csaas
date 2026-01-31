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

  // 行业雷达特定字段 (Story 3.3 - Task 1.2)
  peerName?: string                    // 同业机构名称
  practiceDescription?: string         // 技术实践描述
  estimatedCost?: string              // 投入成本
  implementationPeriod?: string       // 实施周期
  technicalEffect?: string            // 技术效果

  // 合规雷达特定字段 (Story 4.3 - Task 1.1)
  complianceRiskCategory?: string     // 风险类别
  penaltyCase?: string                // 处罚案例摘要
  policyRequirements?: string         // 政策要求
  hasPlaybook?: boolean               // 是否有应对剧本
  playbookStatus?: 'ready' | 'generating' | 'failed'  // 剧本状态
  sentAt?: string                     // 发送时间 (用于排序)
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
  // 修复 Issue #9: apiFetch 已返回解析后的数据,不是 Response 对象
  await apiFetch(`/api/radar/pushes/${pushId}/read`, {
    method: 'POST',
  })
}

/**
 * 行业雷达API方法 (Story 3.3 - Task 1.3)
 */

/**
 * WatchedPeer数据结构
 */
export interface WatchedPeer {
  id: string
  name: string
  type: string
}

/**
 * WatchedPeers响应
 */
export interface WatchedPeersResponse {
  data: WatchedPeer[]
}

/**
 * 获取行业雷达推送列表
 *
 * @param organizationId - 组织ID
 * @param filters - 筛选条件
 * @returns 行业雷达推送列表
 */
export async function getIndustryPushes(
  organizationId: string,
  filters?: {
    filter?: 'all' | 'watched' | 'same-scale' | 'same-region'
    filterByScale?: boolean
    filterByRegion?: boolean
    page?: number
    limit?: number
  }
): Promise<RadarPushesResponse> {
  const params = new URLSearchParams()

  // 固定参数：行业雷达类型和已发送状态
  params.append('radarType', 'industry')
  params.append('status', 'sent')
  params.append('organizationId', organizationId)

  // 可选筛选参数
  if (filters?.filter) params.append('filter', filters.filter)
  if (filters?.filterByScale) params.append('filterByScale', 'true')
  if (filters?.filterByRegion) params.append('filterByRegion', 'true')
  if (filters?.page) params.append('page', String(filters.page))
  if (filters?.limit) params.append('limit', String(filters.limit))

  const data = await apiFetch(`/api/radar/pushes?${params.toString()}`)

  console.log('[getIndustryPushes] API返回数据:', data)

  return data
}

/**
 * 获取行业雷达推送详情
 *
 * @param pushId - 推送ID
 * @returns 行业雷达推送详情
 */
export async function getIndustryPushDetail(pushId: string): Promise<RadarPush> {
  const data = await apiFetch(`/api/radar/pushes/${pushId}`)

  return data
}

/**
 * 标记行业雷达推送为已读
 *
 * @param pushId - 推送ID
 */
export async function markIndustryPushAsRead(pushId: string): Promise<void> {
  // 修复 Issue #9: apiFetch 已返回解析后的数据,不是 Response 对象
  await apiFetch(`/api/radar/pushes/${pushId}/read`, {
    method: 'POST',
  })
}

/**
 * 获取关注的同业列表
 *
 * @param organizationId - 组织ID
 * @returns 关注的同业列表
 */
export async function getWatchedPeers(organizationId: string): Promise<WatchedPeersResponse> {
  const data = await apiFetch(`/api/radar/watched-peers?organizationId=${organizationId}`)

  return data
}

/**
 * 合规雷达API方法 (Story 4.3 - Task 1.2)
 */

/**
 * 自查项数据结构
 */
export interface ChecklistItem {
  id: string
  text: string
  category: string
  checked: boolean
  order: number
}

/**
 * 整改方案数据结构
 */
export interface Solution {
  name: string
  estimatedCost: number
  expectedBenefit: number
  roiScore: number  // 0-10
  implementationTime: string
}

/**
 * 应对剧本数据结构
 */
export interface CompliancePlaybook {
  id: string
  pushId: string
  checklistItems: ChecklistItem[]
  solutions: Solution[]
  reportTemplate: string
  policyReference: string[]
  createdAt: string
  generatedAt: string
}

/**
 * 自查清单提交数据结构
 */
export interface ChecklistSubmissionDto {
  checkedItems: string[]
  uncheckedItems: string[]
}

/**
 * 获取合规雷达推送列表
 *
 * @param organizationId - 组织ID
 * @param filters - 筛选条件
 * @returns 合规雷达推送列表
 */
export async function getCompliancePushes(
  organizationId: string,
  filters?: {
    page?: number
    limit?: number
  }
): Promise<RadarPushesResponse> {
  const params = new URLSearchParams()

  // 固定参数：合规雷达类型和已发送状态
  params.append('radarType', 'compliance')
  params.append('status', 'sent')
  params.append('organizationId', organizationId)

  // 可选筛选参数
  if (filters?.page) params.append('page', String(filters.page))
  if (filters?.limit) params.append('limit', String(filters.limit))

  const data = await apiFetch(`/api/radar/pushes?${params.toString()}`)

  console.log('[getCompliancePushes] API返回数据:', data)

  return data
}

/**
 * 获取应对剧本详情
 *
 * @param pushId - 推送ID
 * @param organizationId - 组织ID
 * @returns 应对剧本详情
 */
export async function getCompliancePlaybook(pushId: string, organizationId: string): Promise<CompliancePlaybook> {
  const data = await apiFetch(`/api/radar/compliance/playbooks/${pushId}?organizationId=${organizationId}`)

  console.log('[getCompliancePlaybook] API返回数据:', data)

  return data
}

/**
 * 提交自查清单
 *
 * @param pushId - 推送ID
 * @param organizationId - 组织ID
 * @param submission - 自查结果
 * @returns 提交结果
 */
export async function submitChecklist(
  pushId: string,
  organizationId: string,
  submission: ChecklistSubmissionDto
): Promise<{ success: boolean; message: string }> {
  const data = await apiFetch(`/api/radar/compliance/playbooks/${pushId}/checklist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...submission,
      organizationId,  // 将 organizationId 包含在请求体中
    }),
  })

  console.log('[submitChecklist] 提交成功:', data)

  return data
}

/**
 * 标记合规雷达推送为已读
 *
 * @param pushId - 推送ID
 */
export async function markCompliancePushAsRead(pushId: string): Promise<void> {
  // 修复 Issue #1 (Code Review 2026-01-31): apiFetch 返回解析后的数据，不是 Response 对象
  // 移除错误的 response.ok 检查，与 markPushAsRead 和 markIndustryPushAsRead 保持一致
  await apiFetch(`/api/radar/pushes/${pushId}/read`, {
    method: 'POST',
  })
}

/**
 * 关注领域配置API方法 (Story 5.1 - Task 3.1)
 */

/**
 * WatchedTopic数据结构
 */
export interface WatchedTopic {
  id: string
  organizationId: string
  topicName: string
  topicType: 'tech' | 'industry'
  description?: string
  createdAt: string
  relatedPushCount?: number
}

/**
 * CreateWatchedTopicDto数据结构
 */
export interface CreateWatchedTopicDto {
  topicName: string
  topicType?: 'tech' | 'industry'
  description?: string
}

/**
 * 获取关注领域列表
 *
 * @param organizationId - 组织ID
 * @returns 关注领域列表
 */
export async function getWatchedTopics(organizationId: string): Promise<WatchedTopic[]> {
  const data = await apiFetch(`/api/radar/watched-topics?organizationId=${organizationId}`)

  console.log('[getWatchedTopics] API返回数据:', data)

  return data
}

/**
 * 创建关注领域
 *
 * @param organizationId - 组织ID
 * @param dto - 创建数据
 * @returns 创建的关注领域
 */
export async function createWatchedTopic(
  organizationId: string,
  dto: CreateWatchedTopicDto
): Promise<WatchedTopic> {
  const data = await apiFetch('/api/radar/watched-topics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...dto,
      organizationId,
    }),
  })

  console.log('[createWatchedTopic] 创建成功:', data)

  return data
}

/**
 * 删除关注领域
 *
 * @param id - 关注领域ID
 * @returns 删除结果
 */
export async function deleteWatchedTopic(id: string): Promise<{ message: string }> {
  const data = await apiFetch(`/api/radar/watched-topics/${id}`, {
    method: 'DELETE',
  })

  console.log('[deleteWatchedTopic] 删除成功:', data)

  return data
}
