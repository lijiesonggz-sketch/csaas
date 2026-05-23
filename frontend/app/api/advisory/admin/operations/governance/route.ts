import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export const dynamic = 'force-dynamic'

const ALLOWED_QUERY_PARAMS = [
  'tenantId',
  'dateFrom',
  'dateTo',
  'workflowType',
  'actorId',
  'eventType',
  'outcome',
  'groupBy',
] as const
const ALLOWED_GROUPS = new Set(['eventType', 'outcome', 'actor', 'workflow'])
const ALLOWED_OUTCOMES = new Set(['success', 'failure', 'denied', 'blocked', 'partial'])

function resolveBackendUrl() {
  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
}

async function resolveAuthorization(request: NextRequest) {
  const session = await getServerSession(authOptions)
  return (
    request.headers.get('authorization') ??
    (session?.accessToken ? `Bearer ${session.accessToken}` : null)
  )
}

function buildBackendGovernanceUrl(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const params = new URLSearchParams()

  for (const key of ALLOWED_QUERY_PARAMS) {
    const values = requestUrl.searchParams.getAll(key)
    if (values.length > 1) {
      throw new Error(`Duplicate query parameter: ${key}`)
    }
    const value = values[0]
    if (value && value !== 'current') {
      assertSafeGovernanceQueryValue(key, value)
      params.set(key, value)
    }
  }

  const query = params.toString()
  return `${resolveBackendUrl()}/advisory/admin/operations/governance${query ? `?${query}` : ''}`
}

function assertSafeGovernanceQueryValue(key: string, value: string) {
  if (
    /PRIVATE_|raw[_\s-]*(conversation|content|prompt|report|feedback|provider|payload)|provider[_\s-]*(raw|payload)|cache[_\s-]*key|full[_\s-]*profile|conversation|prompt|message|report content|feedback/i.test(
      value
    )
  ) {
    throw new Error(`Unsafe query parameter: ${key}`)
  }
  if (key === 'groupBy') {
    const groups = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    if (!groups.length || groups.some((item) => !ALLOWED_GROUPS.has(item))) {
      throw new Error(`Invalid query parameter: ${key}`)
    }
    return
  }
  if (key === 'outcome' && value !== 'all' && !ALLOWED_OUTCOMES.has(value)) {
    throw new Error(`Invalid query parameter: ${key}`)
  }
  if (!/^[a-z0-9][a-z0-9_.:+-]{0,127}$/i.test(value)) {
    throw new Error(`Invalid query parameter: ${key}`)
  }
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await resolveAuthorization(request)

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    let backendGovernanceUrl: string
    try {
      backendGovernanceUrl = buildBackendGovernanceUrl(request)
    } catch {
      return NextResponse.json(
        { message: 'Invalid or duplicate filter parameter' },
        { status: 400 }
      )
    }

    const response = await fetch(backendGovernanceUrl, {
      method: 'GET',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(
        { message: 'Governance review unavailable. No trusted measurements are available.' },
        { status: response.status }
      )
    }

    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/admin/operations/governance] GET error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
