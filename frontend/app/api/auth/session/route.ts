import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

/**
 * GET /api/auth/session
 *
 * Returns the current session data for client-side consumption
 * Used by apiFetch to get the access token
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({}, { status: 401 })
    }

    return NextResponse.json({
      user: session.user,
      accessToken: session.accessToken,
      expires: session.expires,
    })
  } catch (error) {
    console.error('Error getting session:', error)
    return NextResponse.json({}, { status: 500 })
  }
}
