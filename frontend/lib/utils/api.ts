/**
 * API utility functions for making authenticated requests
 */

/**
 * Get authentication token from NextAuth session
 * This works both on client and server side
 */
async function getAuthToken(): Promise<string | null> {
  // Client-side: get from NextAuth cookie
  if (typeof window !== 'undefined') {
    // Try to get token from session storage or make a request to get session
    try {
      const response = await fetch('/api/auth/session')
      console.log('[getAuthToken] /api/auth/session response:', response.status)
      if (response.ok) {
        const session = await response.json()
        console.log('[getAuthToken] session data:', session)
        return session?.accessToken || null
      } else {
        console.log('[getAuthToken] failed to get session:', response.status, response.statusText)
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

  // Get auth token
  const token = await getAuthToken()

  console.log('[apiFetch]', endpoint, 'token:', token ? 'present' : 'missing', 'url:', url)

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

  console.log('[apiFetch]', endpoint, 'response:', response.status, response.statusText)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'API request failed' }))
    throw new Error(error.message || 'API request failed')
  }

  const result = await response.json()

  // 自动提取 result.data
  if (result.success !== undefined && result.data !== undefined) {
    return result.data
  }

  return result
}
