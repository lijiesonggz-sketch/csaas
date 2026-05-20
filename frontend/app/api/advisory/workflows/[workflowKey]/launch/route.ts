import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { workflowKey: string } }) {
  try {
    const backendUrl =
      process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const session = await getServerSession(authOptions)
    const authorization = session?.accessToken ? `Bearer ${session.accessToken}` : null

    if (!authorization) {
      return NextResponse.json({ message: 'No access token' }, { status: 401 })
    }

    const requestBody = await request.json().catch(() => ({}))
    const launchMetadata = normalizeLaunchMetadata(requestBody)
    const fetchInit: RequestInit = {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    }
    if (Object.keys(launchMetadata).length > 0) {
      fetchInit.body = JSON.stringify(launchMetadata)
    }
    const response = await fetch(
      `${backendUrl}/advisory/workflows/${encodeURIComponent(params.workflowKey)}/launch`,
      fetchInit
    )
    const body = await response.json().catch(() => ({}))

    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error('[API /advisory/workflows/:workflowKey/launch] Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

function normalizeLaunchMetadata(value: unknown) {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const quickConsultContextId = toOptionalText(record.quickConsultContextId)
  const acceptedRecommendationId = toOptionalText(record.acceptedRecommendationId)
  const acceptedRecommendation = record.acceptedRecommendation === true
  const manualChoice = record.manualChoice === true
  const manualChoiceKind = toManualChoiceKind(record.manualChoiceKind)
  const manualChoiceId = toOptionalText(record.manualChoiceId)
  const manualChoiceLabel = toOptionalText(record.manualChoiceLabel)

  if (manualChoice) {
    return {
      ...(quickConsultContextId ? { quickConsultContextId } : {}),
      manualChoice: true,
      ...(manualChoiceKind ? { manualChoiceKind } : {}),
      ...(manualChoiceId ? { manualChoiceId } : {}),
      ...(manualChoiceLabel ? { manualChoiceLabel } : {}),
    }
  }

  return {
    ...(quickConsultContextId ? { quickConsultContextId } : {}),
    ...(acceptedRecommendationId ? { acceptedRecommendationId } : {}),
    ...(acceptedRecommendation ? { acceptedRecommendation: true } : {}),
  }
}

function toOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function toManualChoiceKind(value: unknown): 'workflow' | 'method' | undefined {
  return value === 'workflow' || value === 'method' ? value : undefined
}
