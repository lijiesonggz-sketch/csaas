/**
 * JWT Token 解析工具
 */

// 缓存 session 数据
let sessionCache: { token: string | null; userId: string | null; timestamp: number } | null = null
const CACHE_DURATION = 60000 // 1分钟缓存

/**
 * 从 next-auth session 获取 token 和用户信息
 * 使用内存缓存减少 API 调用
 */
async function fetchSession(): Promise<{ token: string | null; userId: string | null }> {
  // 检查缓存
  if (sessionCache && Date.now() - sessionCache.timestamp < CACHE_DURATION) {
    return { token: sessionCache.token, userId: sessionCache.userId }
  }

  try {
    const res = await fetch('/api/auth/session')
    if (!res.ok) {
      return { token: null, userId: null }
    }

    const session = await res.json()
    const token = session.accessToken || null
    const userId = session.user?.id || null

    // 更新缓存
    sessionCache = { token, userId, timestamp: Date.now() }

    return { token, userId }
  } catch (error) {
    console.error('Failed to fetch session:', error)
    return { token: null, userId: null }
  }
}

/**
 * 从 JWT token 中解析 payload
 * @param token JWT token
 * @returns 解析后的 payload 或 null
 */
export function parseJwtToken<T = any>(token: string | null): T | null {
  if (!token) return null

  try {
    // JWT token 格式: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) return null

    // 解析 payload (base64url encoded)
    const payload = parts[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )

    return JSON.parse(jsonPayload) as T
  } catch (error) {
    console.error('Failed to parse JWT token:', error)
    return null
  }
}

/**
 * 从 JWT token 中解析用户ID
 * @param token JWT token
 * @returns 用户ID或null
 */
export function parseUserIdFromToken(token: string | null): string | null {
  const payload = parseJwtToken<{ sub?: string }>(token)
  return payload?.sub || null
}

/**
 * 获取当前用户ID（同步版本 - 使用缓存）
 * 注意：首次调用可能返回 null，建议使用异步版本
 * @returns 用户ID或null
 */
export function getUserIdFromSession(): string | null {
  if (typeof window === 'undefined') return null

  // 如果有缓存，返回缓存的用户ID
  if (sessionCache && Date.now() - sessionCache.timestamp < CACHE_DURATION) {
    return sessionCache.userId
  }

  // 触发异步获取（下次调用时会使用缓存）
  fetchSession().catch(console.error)

  return null
}

/**
 * 获取当前用户ID（异步版本）
 * @returns Promise<用户ID或null>
 */
export async function getUserIdFromSessionAsync(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const { userId } = await fetchSession()
  return userId
}

/**
 * 获取认证 token（异步版本）
 * @returns Promise<token或null>
 */
export async function getAuthTokenAsync(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const { token } = await fetchSession()
  return token
}

/**
 * 获取认证 headers（异步版本）
 * 推荐在 API 调用中使用
 * @returns Promise<HeadersInit>
 */
export async function getAuthHeadersAsync(): Promise<Record<string, string>> {
  const { token, userId } = await fetchSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (userId) {
    headers['x-user-id'] = userId
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

/**
 * 获取认证 headers（同步版本 - 使用缓存）
 * 注意：首次调用可能不包含有效的用户ID和token
 * @returns HeadersInit
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // 使用缓存的数据（如果可用）
  if (sessionCache && Date.now() - sessionCache.timestamp < CACHE_DURATION) {
    if (sessionCache.userId) {
      headers['x-user-id'] = sessionCache.userId
    }
    if (sessionCache.token) {
      headers['Authorization'] = `Bearer ${sessionCache.token}`
    }
  }

  return headers
}

/**
 * 清除 session 缓存
 * 在登录/登出时调用
 */
export function clearSessionCache(): void {
  sessionCache = null
}
