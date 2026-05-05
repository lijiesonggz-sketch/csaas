import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export const dynamic = 'force-dynamic'

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
      return NextResponse.json(
        { message: 'Failed to fetch organization' },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API /organizations/me] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
