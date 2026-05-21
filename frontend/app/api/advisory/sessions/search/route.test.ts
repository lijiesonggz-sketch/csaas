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

describe('/api/advisory/sessions/search proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
    delete process.env.NEXT_PUBLIC_API_URL
  })

  test('[P0][4.3-FE-007][AC2] requires a NextAuth session token', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { GET } = await import('./route')
    const response = await GET(createRequest('http://app.test/api/advisory/sessions/search?q=setup'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('[P0][4.3-FE-008][AC2] proxies search filters without browser-owned tenant or actor authority', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { items: [], meta: { page: 1, limit: 20, total: 0 } } }),
    })

    const { GET } = await import('./route')
    const response = await GET(
      createRequest(
        'http://app.test/api/advisory/sessions/search?q=setup+guidance&type=output&status=completed&tenantId=evil&actorId=evil',
      ),
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/sessions/search?q=setup+guidance&type=output&status=completed',
      {
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    )
    expect(mockFetch.mock.calls[0][0]).not.toContain('evil')
  })

  test('[P0][4.3-FE-009][AC2] passes backend denials through unchanged', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 403,
      json: async () => ({ message: 'Forbidden' }),
    })

    const { GET } = await import('./route')
    const response = await GET(createRequest('http://app.test/api/advisory/sessions/search?q=setup'))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ message: 'Forbidden' })
  })
})
