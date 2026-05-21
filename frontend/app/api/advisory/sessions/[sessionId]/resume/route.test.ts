import { getServerSession } from 'next-auth'

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth/auth-options', () => ({
  authOptions: {},
}))

const mockGetServerSession = getServerSession as jest.Mock
const mockFetch = jest.fn()

function createRequest(body?: unknown) {
  return {
    json: jest.fn(async () => body ?? {}),
  } as unknown as Request
}

describe('/api/advisory/sessions/:sessionId/resume proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
    delete process.env.NEXT_PUBLIC_API_URL
  })

  test('[P0][4.2-FE-005][AC2] requires a NextAuth session token', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { POST } = await import('./route')
    const response = await POST(createRequest(), { params: { sessionId: 'session-1' } })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('[P0][4.2-FE-006][AC2,AC3] proxies resume without relaying caller-supplied tenant fields', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { checkpointSource: 'fallback' } }),
    })

    const { POST } = await import('./route')
    const response = await POST(
      createRequest({ tenantId: 'attacker-tenant', actorId: 'attacker-actor' }),
      { params: { sessionId: 'session 1/with space' } },
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/sessions/session%201%2Fwith%20space/resume',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    )
  })

  test('[P0][4.2-FE-012][AC2] does not proxy server auth through NEXT_PUBLIC_API_URL fallback', async () => {
    delete process.env.INTERNAL_API_URL
    process.env.NEXT_PUBLIC_API_URL = 'https://evil.example'
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { checkpointSource: 'fallback' } }),
    })

    const { POST } = await import('./route')
    const response = await POST(createRequest(), { params: { sessionId: 'session-1' } })

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/advisory/sessions/session-1/resume',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token',
        }),
      }),
    )
    expect(mockFetch.mock.calls[0][0]).not.toContain('evil.example')
  })

  test('[P0][4.2-FE-014][AC2,AC3] passes backend resume denial through without rewriting the response', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 404,
      json: async () => ({ message: 'ThinkTank session not found' }),
    })

    const { POST } = await import('./route')
    const response = await POST(createRequest(), { params: { sessionId: 'session-1' } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ message: 'ThinkTank session not found' })
  })
})
