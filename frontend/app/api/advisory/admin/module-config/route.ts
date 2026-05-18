import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export const dynamic = 'force-dynamic'

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

async function proxyModuleConfig(request: NextRequest, method: 'GET' | 'PUT') {
  try {
    const authorization = await resolveAuthorization(request)

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const response = await fetch(`${resolveBackendUrl()}/advisory/admin/module-config`, {
      method,
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: method === 'PUT' ? await request.text() : undefined,
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({}))

    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error(`[API /advisory/admin/module-config] ${method} error:`, error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return proxyModuleConfig(request, 'GET')
}

export async function PUT(request: NextRequest) {
  return proxyModuleConfig(request, 'PUT')
}
