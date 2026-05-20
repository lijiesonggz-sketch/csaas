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

export async function GET() {
  try {
    const authorization = await readAuthorization()
    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const response = await fetch(`${readBackendUrl()}/advisory/organization-context`, {
      method: 'GET',
      headers: {
        Authorization: authorization,
      },
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({}))

    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/organization-context GET] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const authorization = await readAuthorization()
    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const payload = normalizeOrganizationContextPayload(body)
    const response = await fetch(`${readBackendUrl()}/advisory/organization-context`, {
      method: 'PUT',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    const responseBody = await response.json().catch(() => ({}))

    return NextResponse.json(responseBody, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/organization-context PUT] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

function normalizeOrganizationContextPayload(value: unknown) {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const organizationName = toOptionalText(record.organizationName) ?? ''
  const industry = toOptionalText(record.industry)
  const size = toOptionalText(record.size)

  return {
    organizationName,
    ...(industry ? { industry } : {}),
    ...(size ? { size } : {}),
  }
}

function toOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = normalizeOrganizationContextText(value)
  return text && hasVisibleText(text) ? text : undefined
}

function hasVisibleText(value: string): boolean {
  return normalizeOrganizationContextText(value).length > 0
}

function normalizeOrganizationContextText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\p{C}+/gu, '')
    .trim()
}
