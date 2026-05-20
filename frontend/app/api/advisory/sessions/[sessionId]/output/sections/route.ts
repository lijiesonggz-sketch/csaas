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

export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const authorization = await readAuthorization()

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const response = await fetch(
      `${readBackendUrl()}/advisory/sessions/${encodeURIComponent(params.sessionId)}/output/sections`,
      {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stepIndex: Number.isInteger(body?.stepIndex) ? body.stepIndex : undefined,
          stepLabel: typeof body?.stepLabel === 'string' ? body.stepLabel : undefined,
          contentMarkdown: typeof body?.contentMarkdown === 'string' ? body.contentMarkdown : '',
          sourceMessageId:
            typeof body?.sourceMessageId === 'string' ? body.sourceMessageId : undefined,
          providerMetadata: toSafeProviderMetadata(body?.providerMetadata),
        }),
        cache: 'no-store',
      }
    )
    const responseBody = await response.json().catch(() => ({}))

    return NextResponse.json(responseBody, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/sessions/:sessionId/output/sections POST] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

function toSafeProviderMetadata(metadata: unknown): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined
  const source = metadata as Record<string, unknown>
  const safe: Record<string, unknown> = {}
  const copyText = (key: string) => {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) safe[key] = value.trim()
  }
  const copyNumber = (key: string) => {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) safe[key] = value
  }

  copyText('provider')
  copyText('model')
  copyNumber('latencyMs')
  copyNumber('inputTokens')
  copyNumber('outputTokens')
  copyNumber('totalTokens')
  copyNumber('estimatedCost')

  return Object.keys(safe).length ? safe : undefined
}
