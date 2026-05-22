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

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const authorization = await readAuthorization()

    if (!authorization) {
      return jsonResponse({ message: 'No access token' }, 401)
    }

    const body = await request.json().catch(() => ({}))
    const response = await fetch(
      `${readBackendUrl()}/advisory/sessions/${encodeURIComponent(params.sessionId)}/messages/stream`,
      {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
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
        signal: request.signal,
      }
    )

    const contentType = response.headers.get('Content-Type') ?? ''
    if (!response.ok || !contentType.includes('text/event-stream')) {
      const errorBody = await response.json().catch(() => ({ message: 'Backend unavailable' }))
      return jsonResponse(errorBody, response.status)
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': response.headers.get('Cache-Control') ?? 'no-cache, no-transform',
      },
    })
  } catch (error) {
    console.error('[API /advisory/sessions/:sessionId/messages/stream POST] Error:', error)
    return jsonResponse({ message: 'Internal server error' }, 500)
  }
}
