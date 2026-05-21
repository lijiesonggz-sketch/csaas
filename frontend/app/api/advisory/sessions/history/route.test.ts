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

describe('/api/advisory/sessions/history proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
    delete process.env.NEXT_PUBLIC_API_URL
  })

  test('[P0][4.3-FE-004][AC1] requires a NextAuth session token', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { GET } = await import('./route')
    const response = await GET(createRequest('http://app.test/api/advisory/sessions/history'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('[P0][4.3-FE-005][AC1] proxies only allowed history filters and strips caller scope', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { items: [], meta: { page: 1, limit: 20, total: 0 } } }),
    })

    const { GET } = await import('./route')
    const response = await GET(
      createRequest(
        'http://app.test/api/advisory/sessions/history?q=setup&type=all&workflowKey=problem-solving&status=active&from=2026-05-20T00%3A00%3A00.000Z&to=2026-05-22T00%3A00%3A00.000Z&page=1&limit=20&tenantId=evil&actorId=evil',
      ),
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/sessions/history?q=setup&type=all&workflowKey=problem-solving&status=active&from=2026-05-20T00%3A00%3A00.000Z&to=2026-05-22T00%3A00%3A00.000Z&page=1&limit=20',
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

  test('[P0][4.3-FE-006][AC1] does not use NEXT_PUBLIC_API_URL for server proxy auth', async () => {
    delete process.env.INTERNAL_API_URL
    process.env.NEXT_PUBLIC_API_URL = 'https://evil.example'
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { items: [] } }),
    })

    const { GET } = await import('./route')
    const response = await GET(createRequest('http://app.test/api/advisory/sessions/history'))

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/advisory/sessions/history',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token',
        }),
      }),
    )
    expect(mockFetch.mock.calls[0][0]).not.toContain('evil.example')
  })
})
