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
  if (!organizationId) {
    throw new Error('组织ID不能为空')
  }

  const data = await apiFetch(`/radar/watched-topics?organizationId=${organizationId}`)

  console.log('[getWatchedTopics] API返回数据:', data)

  // 验证返回数据是数组
  if (!Array.isArray(data)) {
    console.error('[getWatchedTopics] 返回数据格式错误:', data)
    throw new Error('服务器返回数据格式错误')
  }

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
  if (!organizationId) {
    throw new Error('组织ID不能为空')
  }

  if (!dto.topicName || dto.topicName.trim() === '') {
    throw new Error('领域名称不能为空')
  }

  try {
    const data = await apiFetch(`/radar/watched-topics?organizationId=${organizationId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    })

    console.log('[createWatchedTopic] 创建成功:', data)

    return data
  } catch (error: any) {
    // 处理特定的错误状态码
    if (error.status === 409 || error.message?.includes('已在关注列表')) {
      throw new Error('该领域已在关注列表中')
    }
    if (error.status === 400) {
      throw new Error('领域名称不能为空')
    }
    throw error
  }
}

/**
 * 删除关注领域
 *
 * @param id - 关注领域ID
 * @param organizationId - 组织ID
 * @returns 删除结果
 */
export async function deleteWatchedTopic(id: string, organizationId: string): Promise<{ message: string }> {
  if (!id) {
    throw new Error('关注领域ID不能为空')
  }

  if (!organizationId) {
    throw new Error('组织ID不能为空')
  }

  try {
    const data = await apiFetch(`/radar/watched-topics/${id}?organizationId=${organizationId}`, {
      method: 'DELETE',
    })

    console.log('[deleteWatchedTopic] 删除成功:', data)

    return data
  } catch (error: any) {
    // 处理特定的错误状态码
    if (error.status === 404) {
      throw new Error('关注领域不存在')
    }
    throw error
  }
}

/**
 * WatchedPeer数据结构 (Story 5.2)
 */
export interface WatchedPeer {
  id: string
  organizationId: string
  peerName: string
  industry: string
  institutionType: string
  description?: string
  createdAt: string
  relatedPushCount?: number
}

/**
 * CreateWatchedPeerDto数据结构 (Story 5.2)
 */
export interface CreateWatchedPeerDto {
  peerName: string
  industry: string
  institutionType: string
  description?: string
}

/**
 * 获取关注同业列表 (Story 5.2 - AC #4)
 *
 * @param organizationId - 组织ID
 * @returns 关注同业列表
 */
export async function getWatchedPeers(organizationId: string): Promise<WatchedPeer[]> {
  if (!organizationId) {
    throw new Error('组织ID不能为空')
  }

  const data = await apiFetch(`/radar/watched-peers?organizationId=${organizationId}`)

  console.log('[getWatchedPeers] API返回数据:', data)

  // 验证返回数据是数组
  if (!Array.isArray(data)) {
    console.error('[getWatchedPeers] 返回数据格式错误:', data)
    throw new Error('服务器返回数据格式错误')
  }

  return data
}

/**
 * 创建关注同业 (Story 5.2 - AC #2)
 *
 * @param organizationId - 组织ID
 * @param dto - 创建数据
 * @returns 创建的关注同业
 */
export async function createWatchedPeer(
  organizationId: string,
  dto: CreateWatchedPeerDto
): Promise<WatchedPeer> {
  if (!organizationId) {
    throw new Error('组织ID不能为空')
  }

  if (!dto.peerName || dto.peerName.trim() === '') {
    throw new Error('同业机构名称不能为空')
  }

  try {
    const data = await apiFetch(`/radar/watched-peers?organizationId=${organizationId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    })

    console.log('[createWatchedPeer] 创建成功:', data)

    return data
  } catch (error: any) {
    // 处理特定的错误状态码
    if (error.status === 409) {
      throw new Error('该同业机构已在关注列表中')
    }
    throw error
  }
}

/**
 * 删除关注同业 (Story 5.2 - AC #3)
 *
 * @param id - 关注同业ID
 * @param organizationId - 组织ID
 * @returns 删除结果
 */
export async function deleteWatchedPeer(id: string, organizationId: string): Promise<{ message: string }> {
  if (!id) {
    throw new Error('关注同业ID不能为空')
  }

  if (!organizationId) {
    throw new Error('组织ID不能为空')
  }

  try {
    const data = await apiFetch(`/radar/watched-peers/${id}?organizationId=${organizationId}`, {
      method: 'DELETE',
    })

    console.log('[deleteWatchedPeer] 删除成功:', data)

    return data
  } catch (error: any) {
    // 处理特定的错误状态码
    if (error.status === 404) {
      throw new Error('关注同业不存在')
    }
    throw error
  }
}

/**
 * 推送偏好配置API方法 (Story 5.3)
 */

/**
 * PushPreference数据结构
 */
export interface PushPreference {
  id: string
  organizationId: string
  pushStartTime: string  // "HH:mm"
  pushEndTime: string    // "HH:mm"
  dailyPushLimit: number // 1-20
  relevanceFilter: 'high_only' | 'high_medium'
  createdAt: string
  updatedAt: string
}

/**
 * UpdatePushPreferenceDto数据结构
 */
export interface UpdatePushPreferenceDto {
  pushStartTime?: string
  pushEndTime?: string
  dailyPushLimit?: number
  relevanceFilter?: 'high_only' | 'high_medium'
}

/**
 * 获取推送偏好设置 (Story 5.3 - AC #2, #3, #4)
 *
 * @param organizationId - 组织ID
 * @returns 推送偏好设置
 */
export async function getPushPreference(organizationId: string): Promise<PushPreference> {
  if (!organizationId) {
    throw new Error('组织ID不能为空')
  }

  const data = await apiFetch(`/radar/push-preferences?organizationId=${organizationId}`)

  console.log('[getPushPreference] API返回数据:', data)

  return data
}

/**
 * 更新推送偏好设置 (Story 5.3 - AC #2, #3, #4)
 *
 * @param organizationId - 组织ID
 * @param dto - 更新数据
 * @returns 更新后的推送偏好设置
 */
export async function updatePushPreference(
  organizationId: string,
  dto: UpdatePushPreferenceDto
): Promise<PushPreference> {
  if (!organizationId) {
    throw new Error('组织ID不能为空')
  }

  try {
    const data = await apiFetch(`/radar/push-preferences?organizationId=${organizationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    })

    console.log('[updatePushPreference] 更新成功:', data)

    return data
  } catch (error: any) {
    if (error.status === 400) {
      throw new Error(error.message || '请求参数错误')
    }
    throw error
  }
}

/**
 * 推送历史查看API方法 (Story 5.4)
 */

/**
 * PushHistoryItem数据结构
 */
export interface PushHistoryItem {
  id: string
  radarType: 'tech' | 'industry' | 'compliance'
  title: string
  summary: string
  relevanceScore: number
  relevanceLevel: 'high' | 'medium' | 'low'
  sentAt: string
  readAt: string | null
  isRead: boolean
  sourceName?: string
  sourceUrl?: string
  weaknessCategories?: string[]
  roiScore?: number
  peerName?: string
  riskLevel?: 'high' | 'medium' | 'low'
  matchedPeers?: string[]
}

/**
 * PushHistoryResponse数据结构
 */
export interface PushHistoryResponse {
  data: PushHistoryItem[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

/**
 * 获取推送历史列表 (Story 5.4 - AC #2-7)
 *
 * 注意：organizationId 由后端 OrganizationGuard 自动从 JWT token 注入，前端无需传递
 *
 * @param filters - 筛选条件
 * @returns 推送历史列表
 */
export async function getPushHistory(
  filters?: {
    radarType?: 'tech' | 'industry' | 'compliance'
    timeRange?: '7d' | '30d' | '90d' | 'all'
    startDate?: string
    endDate?: string
    relevance?: 'high' | 'medium' | 'low' | 'all'
    keyword?: string
    page?: number
    limit?: number
  }
): Promise<PushHistoryResponse> {
  const params = new URLSearchParams()

  // 可选筛选参数
  if (filters?.radarType) params.append('radarType', filters.radarType)
  if (filters?.timeRange) params.append('timeRange', filters.timeRange)
  if (filters?.startDate) params.append('startDate', filters.startDate)
  if (filters?.endDate) params.append('endDate', filters.endDate)
  if (filters?.relevance) params.append('relevance', filters.relevance)
  if (filters?.keyword) params.append('keyword', filters.keyword)
  if (filters?.page) params.append('page', String(filters.page))
  if (filters?.limit) params.append('limit', String(filters.limit))

  const data = await apiFetch(`/api/radar/pushes?${params.toString()}`)

  return data
}

/**
 * 获取未读推送数量 (Story 5.4 - AC #8)
 *
 * 注意：organizationId 由后端 OrganizationGuard 自动从 JWT token 注入
 *
 * @returns 未读推送数量
 */
export async function getUnreadPushCount(): Promise<number> {
  const data = await apiFetch(`/api/radar/pushes/unread-count`)

  return data.count
}

/**
 * 标记推送为已读 (Story 5.4 - AC #8)
 *
 * 注意：organizationId 由后端 OrganizationGuard 自动从 JWT token 注入
 *
 * @param pushId - 推送ID
 */
export async function markPushHistoryAsRead(pushId: string): Promise<void> {
  if (!pushId) {
    throw new Error('推送ID不能为空')
  }

  await apiFetch(`/api/radar/pushes/${pushId}/read`, {
    method: 'PATCH',
  })
}

