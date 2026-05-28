import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export const dynamic = 'force-dynamic'

function parseJsonBody(text: string): unknown {
  if (!text.trim()) {
    return null
  }

  return JSON.parse(text)
}

function parseJsonBodySafely(text: string): unknown {
  try {
    return parseJsonBody(text)
  } catch {
    return null
  }
}

/**
 * GET /api/organizations/me
 *
 * 获取当前用户的组织信息
 * 代理请求到后端 API
 */
export async function GET() {
  try {
    // 获取后端URL
    const backendUrl =
      process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

    const session = await getServerSession(authOptions)
    const token = session?.accessToken

    if (!token) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    // 代理请求到后端
    const response = await fetch(`${backendUrl}/organizations/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      const errorBody = parseJsonBodySafely(text) as { message?: string } | null

      return NextResponse.json(
        { message: errorBody?.message || 'Failed to fetch organization' },
        { status: response.status }
      )
    }

    const text = await response.text()
    const data = parseJsonBody(text)

    if (!data) {
      return NextResponse.json(
        { message: 'Backend returned an empty organization response' },
        { status: 502 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API /organizations/me] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
