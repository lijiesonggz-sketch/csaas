import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const backendUrl =
      process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const session = await getServerSession(authOptions)
    const authorization =
      request.headers.get('authorization') ??
      (session?.accessToken ? `Bearer ${session.accessToken}` : null)

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const response = await fetch(`${backendUrl}/advisory/access`, {
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({}))

    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/access] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
