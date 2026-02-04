/**
 * API utility functions for making authenticated requests
 */

// Token缓存
interface TokenCache {
  token: string | null
  expiresAt: number
}

let tokenCache: TokenCache | null = null
const TOKEN_CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

/**
 * Get authentication token from NextAuth session
 * This works both on client and server side
 */
async function getAuthToken(forceRefresh = false): Promise<string | null> {
  // Client-side: get from NextAuth cookie
  if (typeof window !== 'undefined') {
    // 检查缓存
    if (!forceRefresh && tokenCache && tokenCache.expiresAt > Date.now()) {
      return tokenCache.token
    }

    // 缓存过期或强制刷新，重新获取
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const session = await response.json()
        const token = session?.accessToken || null

        // 更新缓存
        tokenCache = {
          token,
          expiresAt: Date.now() + TOKEN_CACHE_DURATION,
        }

        return token
      }
    } catch (error) {
      console.error('[getAuthToken] Failed to get auth token:', error)
    }
    return null
  }

  // Server-side: import cookies from next/headers
  try {
    const { cookies } = require('next/headers')
    const cookieStore = cookies()
    const nextAuthSession = cookieStore.get('next-auth.session-token')
    return nextAuthSession?.value || null
  } catch {
    return null
  }
}

/**
 * Clear token cache (call this on logout or 401 errors)
 */
export function clearTokenCache() {
  tokenCache = null
}

/**
 * Make an authenticated API request to the backend
 *
 * @param endpoint - API endpoint (e.g., '/organizations/:id/radar-status')
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<any> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${process.env.NEXT_PUBLIC_API_URL || ''}${endpoint}`

  // Get auth token (from cache if available)
  const token = await getAuthToken()

  // Prepare headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  // Add authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // 如果是401错误，清除token缓存并重试一次
  if (response.status === 401 && tokenCache) {
    clearTokenCache()
    const newToken = await getAuthToken(true)

    if (newToken && newToken !== token) {
      // Token已更新，重试请求
      headers['Authorization'] = `Bearer ${newToken}`
      const retryResponse = await fetch(url, {
        ...options,
        headers,
      })

      if (retryResponse.ok) {
        return handleResponse(retryResponse)
      }
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'API request failed' }))
    throw new Error(error.message || 'API request failed')
  }

  return handleResponse(response)
}

/**
 * Handle API response
 */
async function handleResponse(response: Response): Promise<any> {
  // 处理 204 No Content 响应（删除操作等）
  if (response.status === 204) {
    return null
  }

  const result = await response.json()

  // 自动提取 result.data
  if (result.success !== undefined && result.data !== undefined) {
    return result.data
  }

  return result
}
