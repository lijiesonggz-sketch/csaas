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

describe('GET /api/organizations/me', () => {
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

  it('returns 401 when there is no access token', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('proxies the request to the backend with the session access token', async () => {
    const organization = { id: 'org-1', name: '示例机构' }
    mockGetServerSession.mockResolvedValue({ accessToken: 'access-token' })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => organization,
    })

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(organization)
    expect(mockFetch).toHaveBeenCalledWith('http://backend.internal/organizations/me', {
      headers: {
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
  })

  it('propagates backend failure status', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'access-token' })
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
    })

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({ message: 'Failed to fetch organization' })
  })
})
