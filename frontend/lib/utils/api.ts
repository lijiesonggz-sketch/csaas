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
      if (response.ok) {
        const session = await response.json()
        return session?.accessToken || null
      }
    } catch (error) {
      console.error('Failed to get auth token:', error)
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
): Promise<Response> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${process.env.NEXT_PUBLIC_API_URL || ''}${endpoint}`

  // Get auth token
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

  return fetch(url, {
    ...options,
    headers,
  })
}
