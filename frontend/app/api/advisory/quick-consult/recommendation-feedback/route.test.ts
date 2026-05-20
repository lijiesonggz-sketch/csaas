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

describe('POST /api/advisory/quick-consult/recommendation-feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  it('requires a NextAuth session token', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { POST } = await import('./route')
    const response = await POST(createRequest({ quickConsultContextId: 'context-1', rating: 5 }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('proxies only whitelisted recommendation feedback fields to the backend', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 201,
      json: async () => ({
        data: {
          id: 'feedback-35',
          quickConsultContextId: 'quick-consult-context-35',
          rating: 5,
        },
      }),
    })

    const { POST } = await import('./route')
    const response = await POST(
      createRequest({
        tenantId: 'attacker-tenant',
        actorId: 'attacker-actor',
        rawProblem: 'drop me',
        prompt: 'drop me',
        quickConsultContextId: ' quick-consult-context-35 ',
        rating: 5,
        feedbackText: '  推荐方向有帮助。  ',
        recommendationIds: [' rec-1 ', '', 42, 'rec-1', 'rec-2'],
      })
    )

    expect(response.status).toBe(201)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/quick-consult/recommendation-feedback',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quickConsultContextId: 'quick-consult-context-35',
          rating: 5,
          feedbackText: '推荐方向有帮助。',
          recommendationIds: ['rec-1', 'rec-2'],
        }),
        cache: 'no-store',
      }
    )
    expect(mockFetch.mock.calls[0][1].body).not.toContain('attacker-tenant')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('attacker-actor')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('rawProblem')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('prompt')
  })
})
