/**
 * Branding API Client
 *
 * Story 6.3: 白标输出功能
 *
 * 提供品牌配置管理的API调用
 */

import { apiFetch } from '../utils/api'

/**
 * 品牌配置数据结构
 */
export interface BrandingConfig {
  logoUrl?: string
  brandPrimaryColor: string
  brandSecondaryColor?: string
  companyName?: string
  emailSignature?: string
  contactPhone?: string
  contactEmail?: string
}

/**
 * 更新品牌配置的数据
 */
export interface UpdateBrandingData {
  brandPrimaryColor?: string
  brandSecondaryColor?: string
  companyName?: string
  emailSignature?: string
  contactPhone?: string
  contactEmail?: string
}

/**
 * 品牌配置响应
 */
export interface BrandingResponse {
  success: boolean
  data: BrandingConfig
  message?: string
}

/**
 * Logo 上传响应
 */
export interface LogoUploadResponse {
  success: boolean
  data: {
    logoUrl: string
  }
  message?: string
}

/**
 * 获取品牌配置 (Admin)
 *
 * @returns 品牌配置数据
 */
export async function getAdminBranding(): Promise<BrandingConfig> {
  return apiFetch('/api/v1/admin/branding', {
    method: 'GET',
  })
}

/**
 * 更新品牌配置 (Admin)
 *
 * @param data - 更新的品牌配置数据
 * @returns 更新后的品牌配置
 */
export async function updateBranding(
  data: UpdateBrandingData,
): Promise<BrandingConfig> {
  return apiFetch('/api/v1/admin/branding', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * 上传品牌 Logo (Admin)
 *
 * @param file - Logo 文件 (PNG/JPG/SVG)
 * @returns 上传后的 Logo URL
 */
export async function uploadLogo(file: File): Promise<LogoUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  // 使用 fetch 而不是 apiFetch，因为需要发送 FormData
  const token = localStorage.getItem('token')
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/branding/logo`,
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
    throw new Error(error.message || 'Logo 上传失败')
  }

  return response.json()
}

/**
 * 获取租户品牌配置 (公开接口)
 *
 * @param tenantId - 可选的租户ID，如果不提供则从session中获取
 * @returns 租户品牌配置数据
 */
export async function getTenantBranding(tenantId?: string): Promise<BrandingConfig> {
  const headers: Record<string, string> = {}

  // If tenantId is provided, add it to headers
  if (tenantId) {
    headers['x-tenant-id'] = tenantId
  } else {
    // Try to get tenantId from session
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch('/api/auth/session')
        if (response.ok) {
          const session = await response.json()
          if (session?.user?.tenantId) {
            headers['x-tenant-id'] = session.user.tenantId
          }
        }
      } catch (error) {
        console.error('Failed to get session for tenantId:', error)
      }
    }
  }

  return apiFetch('/api/v1/tenant/branding', {
    method: 'GET',
    headers,
  })
}

/**
 * 重置品牌配置为默认值 (Admin)
 *
 * @returns 重置后的品牌配置
 */
export async function resetBranding(): Promise<BrandingConfig> {
  return updateBranding({
    brandPrimaryColor: '#1890ff',
    brandSecondaryColor: undefined,
    companyName: undefined,
    emailSignature: undefined,
    contactPhone: undefined,
    contactEmail: undefined,
  })
}
