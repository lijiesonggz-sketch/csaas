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

export async function POST(request: Request) {
  try {
    const authorization = await readAuthorization()

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const quickConsultContextId = toOptionalText(body?.quickConsultContextId)
    const feedbackText = toOptionalText(body?.feedbackText)
    const recommendationIds = toOptionalTextList(body?.recommendationIds)
    const response = await fetch(
      `${readBackendUrl()}/advisory/quick-consult/recommendation-feedback`,
      {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quickConsultContextId,
          rating: body?.rating,
          feedbackText,
          recommendationIds: recommendationIds.length > 0 ? recommendationIds : undefined,
        }),
        cache: 'no-store',
      }
    )
    const responseBody = await response.json().catch(() => ({}))

    return NextResponse.json(responseBody, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/quick-consult/recommendation-feedback POST] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

function toOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function toOptionalTextList(value: unknown): string[] {
  const seen = new Set<string>()

  return (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
    .slice(0, 10)
}
