import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export const dynamic = 'force-dynamic'

interface QuickConsultClarificationAnswerPayload {
  question: string
  answer: string
}

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
    const clarificationAnswers = normalizeClarificationAnswers(body?.clarificationAnswers)
    const response = await fetch(`${readBackendUrl()}/advisory/quick-consult/start`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        problem: typeof body?.problem === 'string' ? body.problem : '',
        contextId: typeof body?.contextId === 'string' ? body.contextId : undefined,
        originalProblem:
          typeof body?.originalProblem === 'string' ? body.originalProblem : undefined,
        clarificationAnswers: clarificationAnswers.length > 0 ? clarificationAnswers : undefined,
      }),
      cache: 'no-store',
    })
    const responseBody = await response.json().catch(() => ({}))

    return NextResponse.json(responseBody, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/quick-consult/start POST] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

function normalizeClarificationAnswers(value: unknown): QuickConsultClarificationAnswerPayload[] {
  return (Array.isArray(value) ? value : [])
    .filter((answer) => answer && typeof answer === 'object')
    .map((answer) => {
      const record = answer as Record<string, unknown>

      return {
        question: typeof record.question === 'string' ? record.question.trim() : '',
        answer: typeof record.answer === 'string' ? record.answer.trim() : '',
      }
    })
    .filter((answer) => answer.question && answer.answer)
    .slice(0, 2)
}
