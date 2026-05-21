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

function createRequest(url: string) {
  return { url } as Request
}

describe('/api/advisory/sessions/:sessionId/output/state proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  test('[P1][4.4-FE-016][AC2] exports force-dynamic for output state route', async () => {
    const route = await import('./route')

    expect(route.dynamic).toBe('force-dynamic')
  })

  test('[P0][4.4-FE-017][AC4] requires a NextAuth token before reading asset state', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { GET } = await import('./route')
    const response = await GET(
      createRequest('http://localhost/api/advisory/sessions/session-1/output/state?outputId=output-1'),
      { params: { sessionId: 'session-1' } },
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('[P0][4.4-FE-018][AC2,AC4] forwards only the outputId query to backend', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          assetState: {
            outputId: 'output-1',
            rating: 4,
            feedbackTextPresent: true,
            isFavorited: true,
            updatedAt: '2026-05-21T06:10:00.000Z',
          },
        },
      }),
    })

    const { GET } = await import('./route')
    const response = await GET(
      createRequest(
        'http://localhost/api/advisory/sessions/session-1/output/state?outputId=%20output-1%20&tenantId=attacker-tenant',
      ),
      { params: { sessionId: 'session id/with space' } },
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/sessions/session%20id%2Fwith%20space/output/state?outputId=output-1',
      {
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    )
  })
})
