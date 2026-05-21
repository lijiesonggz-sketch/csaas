import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export const dynamic = 'force-dynamic'

function readBackendUrl() {
  return process.env.INTERNAL_API_URL || 'http://localhost:3000'
}

async function readAuthorization() {
  const session = await getServerSession(authOptions)
  return session?.accessToken ? `Bearer ${session.accessToken}` : null
}

export async function DELETE(
  _request: Request,
  { params }: { params: { sessionId: string; outputId: string } }
) {
  try {
    const authorization = await readAuthorization()

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const response = await fetch(
      `${readBackendUrl()}/advisory/sessions/${encodeURIComponent(
        params.sessionId
      )}/output/${encodeURIComponent(params.outputId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )
    const body = await response.json().catch(() => ({}))

    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/sessions/:sessionId/output/:outputId DELETE] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
