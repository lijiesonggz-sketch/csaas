/**
 * Clients API Client
 *
 * Story 6.2: 咨询公司批量客户管理后台
 *
 * 提供客户管理的API调用
 */

import { apiFetch } from '../utils/api'

/**
 * 行业类型枚举
 */
export enum IndustryType {
  BANKING = 'banking',
  SECURITIES = 'securities',
  INSURANCE = 'insurance',
  ENTERPRISE = 'enterprise',
}

/**
 * 机构规模枚举
 */
export enum OrganizationScale {
  LARGE = 'large',
  MEDIUM = 'medium',
  SMALL = 'small',
}

/**
 * 机构状态枚举
 */
export enum OrganizationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TRIAL = 'trial',
}

/**
 * 相关性过滤级别
 */
export enum RelevanceFilter {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * 客户数据结构
 */
export interface Client {
  id: string
  name: string
  contactPerson?: string
  contactEmail?: string
  industryType?: IndustryType
  scale?: OrganizationScale
  status?: OrganizationStatus
  pushStartTime?: string
  pushEndTime?: string
  dailyPushLimit?: number
  relevanceFilter?: RelevanceFilter
  createdAt: string
  updatedAt: string
  // 统计数据
  userCount?: number
  pushCount?: number
  lastPushAt?: string
}

/**
 * 创建客户数据
 */
export interface CreateClientData {
  name: string
  contactPerson?: string
  contactEmail?: string
  industryType?: IndustryType
  scale?: OrganizationScale
}

/**
 * 更新客户数据
 */
export interface UpdateClientData {
  name?: string
  contactPerson?: string
  contactEmail?: string
  industryType?: IndustryType
  scale?: OrganizationScale
  status?: OrganizationStatus
}

/**
 * 批量配置数据
 */
export interface BulkConfigData {
  organizationIds: string[]
  pushStartTime?: string
  pushEndTime?: string
  dailyPushLimit?: number
  relevanceFilter?: RelevanceFilter
}

/**
 * 批量导入结果
 */
export interface BulkImportResult {
  total: number
  success: number
  failed: number
  successList: Client[]
  failedList: Array<{
    row: number
    data: CreateClientData
    error: string
  }>
}

/**
 * 客户分组数据结构
 */
export interface ClientGroup {
  id: string
  name: string
  description?: string
  tenantId: string
  createdAt: string
  updatedAt: string
  memberships?: Array<{
    id: string
    organizationId: string
    organization?: Client
  }>
}

/**
 * 创建客户分组数据
 */
export interface CreateClientGroupData {
  name: string
  description?: string
}

/**
 * 客户统计数据
 */
export interface ClientStatistics {
  total: number
  active: number
  inactive: number
  trial: number
  byIndustry: Record<IndustryType, number>
  byScale: Record<OrganizationScale, number>
}

/**
 * 获取客户列表
 *
 * @returns 客户列表
 */
export async function getClients(): Promise<Client[]> {
  return apiFetch<Client[]>('/api/v1/admin/clients', {
    method: 'GET',
  })
}

/**
 * 获取客户详情
 *
 * @param id - 客户ID
 * @returns 客户详情
 */
export async function getClient(id: string): Promise<Client> {
  return apiFetch<Client>(`/api/v1/admin/clients/${id}`, {
    method: 'GET',
  })
}

/**
 * 创建客户
 *
 * @param data - 客户数据
 * @returns 创建的客户
 */
export async function createClient(data: CreateClientData): Promise<Client> {
  return apiFetch<Client>('/api/v1/admin/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 更新客户
 *
 * @param id - 客户ID
 * @param data - 更新数据
 * @returns 更新后的客户
 */
export async function updateClient(id: string, data: UpdateClientData): Promise<Client> {
  return apiFetch<Client>(`/api/v1/admin/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * 删除客户
 *
 * @param id - 客户ID
 */
export async function deleteClient(id: string): Promise<void> {
  return apiFetch<void>(`/api/v1/admin/clients/${id}`, {
    method: 'DELETE',
  })
}

/**
 * 批量创建客户
 *
 * @param clients - 客户数据数组
 * @returns 批量创建结果
 */
export async function bulkCreateClients(
  clients: CreateClientData[],
): Promise<BulkImportResult> {
  return apiFetch<BulkImportResult>('/api/v1/admin/clients/bulk', {
    method: 'POST',
    body: JSON.stringify(clients),
  })
}

/**
 * CSV 批量导入客户
 *
 * @param file - CSV 文件
 * @returns 批量导入结果
 */
export async function bulkImportFromCsv(file: File): Promise<BulkImportResult> {
  const formData = new FormData()
  formData.append('file', file)

  const token = localStorage.getItem('token')
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/clients/bulk-csv`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    },
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'CSV 导入失败')
  }

  return response.json()
}

/**
 * 下载 CSV 模板
 */
export async function downloadCsvTemplate(): Promise<void> {
  const token = localStorage.getItem('token')
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/clients/csv-template/download`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  if (!response.ok) {
    throw new Error('下载模板失败')
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'client-import-template.csv'
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

/**
 * 批量配置客户
 *
 * @param data - 批量配置数据
 * @returns 更新的客户数量
 */
export async function bulkConfigClients(
  data: BulkConfigData,
): Promise<{ updatedCount: number }> {
  return apiFetch<{ updatedCount: number }>('/api/v1/admin/clients/bulk-config', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 获取客户统计
 *
 * @returns 统计数据
 */
export async function getClientStatistics(): Promise<ClientStatistics> {
  return apiFetch<ClientStatistics>('/api/v1/admin/clients/statistics/overview', {
    method: 'GET',
  })
}

/**
 * 获取客户分组列表
 *
 * @returns 分组列表
 */
export async function getClientGroups(): Promise<ClientGroup[]> {
  return apiFetch<ClientGroup[]>('/api/v1/admin/client-groups', {
    method: 'GET',
  })
}

/**
 * 获取客户分组详情
 *
 * @param id - 分组ID
 * @returns 分组详情
 */
export async function getClientGroup(id: string): Promise<ClientGroup> {
  return apiFetch<ClientGroup>(`/api/v1/admin/client-groups/${id}`, {
    method: 'GET',
  })
}

/**
 * 创建客户分组
 *
 * @param data - 分组数据
 * @returns 创建的分组
 */
export async function createClientGroup(data: CreateClientGroupData): Promise<ClientGroup> {
  return apiFetch<ClientGroup>('/api/v1/admin/client-groups', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 更新客户分组
 *
 * @param id - 分组ID
 * @param data - 更新数据
 * @returns 更新后的分组
 */
export async function updateClientGroup(
  id: string,
  data: CreateClientGroupData,
): Promise<ClientGroup> {
  return apiFetch<ClientGroup>(`/api/v1/admin/client-groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * 删除客户分组
 *
 * @param id - 分组ID
 */
export async function deleteClientGroup(id: string): Promise<void> {
  return apiFetch<void>(`/api/v1/admin/client-groups/${id}`, {
    method: 'DELETE',
  })
}

/**
 * 添加客户到分组
 *
 * @param groupId - 分组ID
 * @param organizationIds - 客户ID列表
 * @returns 添加的客户数量
 */
export async function addClientsToGroup(
  groupId: string,
  organizationIds: string[],
): Promise<{ addedCount: number }> {
  return apiFetch<{ addedCount: number }>(
    `/api/v1/admin/client-groups/${groupId}/clients`,
    {
      method: 'POST',
      body: JSON.stringify({ organizationIds }),
    },
  )
}

/**
 * 从分组移除客户
 *
 * @param groupId - 分组ID
 * @param organizationId - 客户ID
 */
export async function removeClientFromGroup(
  groupId: string,
  organizationId: string,
): Promise<void> {
  return apiFetch<void>(
    `/api/v1/admin/client-groups/${groupId}/clients/${organizationId}`,
    {
      method: 'DELETE',
    },
  )
}
