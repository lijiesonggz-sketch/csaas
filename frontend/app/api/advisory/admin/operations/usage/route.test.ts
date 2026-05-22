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

function createRequest(url: string, headers: Record<string, string | undefined> = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  )

  return {
    url,
    headers: {
      get: (name: string) => normalizedHeaders[name.toLowerCase()] ?? null,
    },
  }
}

describe('/api/advisory/admin/operations/usage proxy route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ data: { freshness: { status: 'fresh' } } }),
    })
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  it('forwards GET usage with whitelisted filters and request authorization', async () => {
    const { GET } = await import('./route')
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })

    const response = await GET(
      createRequest(
        'http://frontend.test/api/advisory/admin/operations/usage?tenantId=tenant-alpha&dateFrom=2026-05-01&dateTo=2026-05-22&workflowType=problem-solving&actorId=malicious',
        { authorization: 'Bearer request-token' },
      ) as never,
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ data: { freshness: { status: 'fresh' } } })
    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/admin/operations/usage?tenantId=tenant-alpha&dateFrom=2026-05-01&dateTo=2026-05-22&workflowType=problem-solving',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer request-token',
          'Content-Type': 'application/json',
        }),
        cache: 'no-store',
      }),
    )
  })

  it('falls back to the session token and returns 401 without any token source', async () => {
    const { GET } = await import('./route')
    mockGetServerSession.mockResolvedValueOnce({ accessToken: 'session-token' })

    await GET(createRequest('http://frontend.test/api/advisory/admin/operations/usage') as never)
    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/admin/operations/usage',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer session-token' }),
      }),
    )

    mockGetServerSession.mockResolvedValueOnce(null)
    const unauthorized = await GET(
      createRequest('http://frontend.test/api/advisory/admin/operations/usage') as never,
    )
    expect(unauthorized.status).toBe(401)
  })

  it('rejects duplicate whitelisted query parameters before proxying', async () => {
    const { GET } = await import('./route')
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })

    const response = await GET(
      createRequest(
        'http://frontend.test/api/advisory/admin/operations/usage?tenantId=tenant-alpha&tenantId=tenant-beta',
      ) as never,
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ message: 'Duplicate filter parameter' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('propagates upstream tenant-denied responses without rewriting the response body', async () => {
    const { GET } = await import('./route')
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 403,
      json: async () => ({ message: '当前账号无权查看其他租户的 ThinkTank 运营数据。' }),
    })

    const response = await GET(
      createRequest(
        'http://frontend.test/api/advisory/admin/operations/usage?tenantId=tenant-forbidden',
      ) as never,
    )
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ message: '当前账号无权查看其他租户的 ThinkTank 运营数据。' })
    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/admin/operations/usage?tenantId=tenant-forbidden',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      }),
    )
  })
})
