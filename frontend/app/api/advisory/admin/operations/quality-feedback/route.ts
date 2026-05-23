import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export const dynamic = 'force-dynamic'

const ALLOWED_QUERY_PARAMS = [
  'tenantId',
  'dateFrom',
  'dateTo',
  'workflowType',
  'recommendationType',
  'groupBy',
  'timeBucket',
] as const

function resolveBackendUrl() {
  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
}

async function resolveAuthorization(request: NextRequest) {
  const session = await getServerSession(authOptions)
  return (
    (session?.accessToken ? `Bearer ${session.accessToken}` : null) ??
    request.headers.get('authorization')
  )
}

function buildBackendQualityFeedbackUrl(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const params = new URLSearchParams()

  for (const key of ALLOWED_QUERY_PARAMS) {
    const values = requestUrl.searchParams.getAll(key)
    if (values.length > 1) {
      throw new Error(`Duplicate query parameter: ${key}`)
    }
    const value = values[0]
    if (value && value !== 'current') params.set(key, value)
  }

  const query = params.toString()
  return `${resolveBackendUrl()}/advisory/admin/operations/quality-feedback${query ? `?${query}` : ''}`
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await resolveAuthorization(request)

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    let backendQualityFeedbackUrl: string
    try {
      backendQualityFeedbackUrl = buildBackendQualityFeedbackUrl(request)
    } catch {
      return NextResponse.json({ message: 'Duplicate filter parameter' }, { status: 400 })
    }

    const response = await fetch(backendQualityFeedbackUrl, {
      method: 'GET',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({}))

    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/admin/operations/quality-feedback] GET error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
