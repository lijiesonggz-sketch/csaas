import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'NOT_SET'
  const testResponse = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'radar-test@example.com',
      password: 'Test123456'
    })
  })

  const result = await testResponse.json()

  return NextResponse.json({
    env: {
      NEXT_PUBLIC_API_URL: apiUrl,
      NODE_ENV: process.env.NODE_ENV,
    },
    backendResponse: {
      status: testResponse.status,
      ok: testResponse.ok,
      body: result
    }
  })
}
