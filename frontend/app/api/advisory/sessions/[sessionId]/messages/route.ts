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

export async function GET(_request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const authorization = await readAuthorization()

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const response = await fetch(
      `${readBackendUrl()}/advisory/sessions/${encodeURIComponent(params.sessionId)}/messages`,
      {
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
    console.error('[API /advisory/sessions/:sessionId/messages GET] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const authorization = await readAuthorization()

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const response = await fetch(
      `${readBackendUrl()}/advisory/sessions/${encodeURIComponent(params.sessionId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: typeof body?.content === 'string' ? body.content : '',
          decisionAction:
            typeof body?.decisionAction === 'string' ? body.decisionAction : undefined,
          addressedAdvisorId:
            typeof body?.addressedAdvisorId === 'string' ? body.addressedAdvisorId : undefined,
          addressedMessageId:
            typeof body?.addressedMessageId === 'string' ? body.addressedMessageId : undefined,
        }),
        cache: 'no-store',
      }
    )
    const responseBody = await response.json().catch(() => ({}))

    return NextResponse.json(responseBody, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/sessions/:sessionId/messages POST] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
