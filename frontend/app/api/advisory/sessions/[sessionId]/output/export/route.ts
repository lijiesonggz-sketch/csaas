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

export async function GET(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const authorization = await readAuthorization()

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') ?? ''
    const response = await fetch(
      `${readBackendUrl()}/advisory/sessions/${encodeURIComponent(
        params.sessionId
      )}/output/export?format=${encodeURIComponent(format)}`,
      {
        headers: {
          Authorization: authorization,
        },
        cache: 'no-store',
      }
    )
    const headers: Record<string, string> = {}
    const contentType = response.headers.get('Content-Type')
    const contentDisposition = response.headers.get('Content-Disposition')

    if (contentType) headers['Content-Type'] = contentType
    if (contentDisposition) headers['Content-Disposition'] = contentDisposition

    return new Response(response.body ?? (await response.arrayBuffer()), {
      status: response.status,
      headers,
    })
  } catch (error) {
    console.error('[API /advisory/sessions/:sessionId/output/export GET] Error:', error)
    return NextResponse.json(
      { message: '报告导出失败，请重试；如果仍失败，请检查网络或联系管理员。' },
      { status: 500 }
    )
  }
}
