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

function createRequest(body: unknown) {
  return {
    json: async () => body,
  } as Request
}

describe('/api/advisory/sessions/:sessionId/output/rating proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  test('[P0][4.4-FE-006][AC1] exports force-dynamic for output rating route', async () => {
    const route = await import('./route')

    expect(route.dynamic).toBe('force-dynamic')
  })

  test('[P0][4.4-FE-007][AC1,AC4] requires a NextAuth token before forwarding rating', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { PUT } = await import('./route')
    const response = await PUT(createRequest({ outputId: 'output-1', rating: 5 }), {
      params: { sessionId: 'session-1' },
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('[P0][4.4-FE-008][AC1,AC4] forwards only safe rating fields to backend', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          assetState: {
            outputId: 'output-1',
            rating: 5,
            feedbackTextPresent: true,
            isFavorited: false,
            updatedAt: '2026-05-21T06:05:00.000Z',
          },
        },
      }),
    })

    const { PUT } = await import('./route')
    const response = await PUT(
      createRequest({
        outputId: ' output-1 ',
        rating: 5,
        feedbackText: '  高管摘要很有帮助  ',
        tenantId: 'attacker-tenant',
        actorId: 'attacker-actor',
        contentMarkdown: 'raw report body',
      }),
      { params: { sessionId: 'session id/with space' } }
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/sessions/session%20id%2Fwith%20space/output/rating',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outputId: 'output-1',
          rating: 5,
          feedbackText: '高管摘要很有帮助',
        }),
        cache: 'no-store',
      }
    )
    expect(mockFetch.mock.calls[0][1].body).not.toContain('attacker')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('raw report')
  })
})
