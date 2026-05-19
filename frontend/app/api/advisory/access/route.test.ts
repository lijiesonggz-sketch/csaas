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

function createRequest(headers: Record<string, string | undefined> = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  )

  return {
    headers: {
      get: (name: string) => normalizedHeaders[name.toLowerCase()] ?? null,
    },
  }
}

describe('GET /api/advisory/access', () => {
  const originalFetch = global.fetch
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = mockFetch
    process.env = {
      ...originalEnv,
      INTERNAL_API_URL: 'http://backend.internal',
      NEXT_PUBLIC_API_URL: undefined,
    }
  })

  afterAll(() => {
    global.fetch = originalFetch
    process.env = originalEnv
  })

  it('proxies access checks with the request Authorization header when no session exists', async () => {
    mockGetServerSession.mockResolvedValue(null)
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { allowed: true, module: 'thinktank' } }),
    })

    const { GET } = await import('./route')
    const response = await (GET as (request: unknown) => Promise<Response>)(
      createRequest({ authorization: 'Bearer caller-token' })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ data: { allowed: true, module: 'thinktank' } })
    expect(mockFetch).toHaveBeenCalledWith('http://backend.internal/advisory/access', {
      headers: {
        Authorization: 'Bearer caller-token',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
  })

  it('proxies access checks with the NextAuth session token when no request header exists', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { allowed: true, module: 'thinktank' } }),
    })

    const { GET } = await import('./route')
    const response = await (GET as (request: unknown) => Promise<Response>)(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ data: { allowed: true, module: 'thinktank' } })
    expect(mockFetch).toHaveBeenCalledWith('http://backend.internal/advisory/access', {
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
  })

  it('returns 401 when no authorization source exists', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { GET } = await import('./route')
    const response = await (GET as (request: unknown) => Promise<Response>)(createRequest())
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('propagates backend authorization failures', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 403,
      json: async () => ({ message: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。' }),
    })

    const { GET } = await import('./route')
    const response = await (GET as (request: unknown) => Promise<Response>)(createRequest())
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ message: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。' })
  })
})
