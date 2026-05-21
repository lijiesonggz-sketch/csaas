import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export const dynamic = 'force-dynamic'

function readBackendUrl() {
  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
}

async function readAuthorization() {
  const session = await getServerSession(authOptions)
  return session?.accessToken ? `Bearer ${session.accessToken}` : null
}

export async function GET(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const authorization = await readAuthorization()

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const sourceUrl = new URL(request.url)
    const targetUrl = new URL(
      `/advisory/sessions/${encodeURIComponent(params.sessionId)}/output/state`,
      readBackendUrl()
    )
    const outputId = sourceUrl.searchParams.get('outputId')
    if (outputId?.trim()) {
      targetUrl.searchParams.set('outputId', outputId.trim())
    }

    const response = await fetch(targetUrl.toString(), {
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
    const responseBody = await response.json().catch(() => ({}))

    return NextResponse.json(responseBody, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/sessions/:sessionId/output/state GET] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
