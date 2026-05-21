import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export const dynamic = 'force-dynamic'

const HISTORY_QUERY_KEYS = ['q', 'type', 'workflowKey', 'status', 'from', 'to', 'page', 'limit']

function readBackendUrl() {
  return process.env.INTERNAL_API_URL || 'http://localhost:3000'
}

async function readAuthorization() {
  const session = await getServerSession(authOptions)
  return session?.accessToken ? `Bearer ${session.accessToken}` : null
}

function buildBackendUrl(request: Request) {
  const sourceUrl = new URL(request.url)
  const targetUrl = new URL('/advisory/sessions/history', readBackendUrl())

  HISTORY_QUERY_KEYS.forEach((key) => {
    const value = sourceUrl.searchParams.get(key)
    if (value?.trim()) {
      targetUrl.searchParams.set(key, value.trim())
    }
  })

  return targetUrl.toString()
}

export async function GET(request: Request) {
  try {
    const authorization = await readAuthorization()

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const response = await fetch(buildBackendUrl(request), {
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({}))

    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/sessions/history] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
