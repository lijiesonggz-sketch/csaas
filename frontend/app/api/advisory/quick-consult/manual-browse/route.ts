import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const backendUrl =
      process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const session = await getServerSession(authOptions)
    const authorization = session?.accessToken ? `Bearer ${session.accessToken}` : null

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const requestBody = await request.json().catch(() => ({}))
    const quickConsultContextId = toOptionalText(requestBody?.quickConsultContextId)
    const response = await fetch(`${backendUrl}/advisory/quick-consult/manual-browse`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(quickConsultContextId ? { quickConsultContextId } : {}),
      }),
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({}))

    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/quick-consult/manual-browse POST] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

function toOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
