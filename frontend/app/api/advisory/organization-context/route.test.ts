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

describe('/api/advisory/organization-context proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  it('requires a NextAuth session token for GET', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('proxies GET with only the session token', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { context: null } }),
    })

    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith('http://backend.test/advisory/organization-context', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer session-token',
      },
      cache: 'no-store',
    })
  })

  it('returns backend GET errors without rewriting the response body', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 403,
      json: async () => ({ message: 'ThinkTank unavailable' }),
    })

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ message: 'ThinkTank unavailable' })
  })

  it('returns 500 when the backend GET request fails before a response is available', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockRejectedValue(new Error('network down'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ message: 'Internal server error' })
  })

  it('proxies PUT with whitelisted trimmed fields and drops tenant/completeness fields', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { id: 'context-1' } }),
    })

    const { PUT } = await import('./route')
    const response = await PUT(
      createRequest({
        organizationName: '  Tenant\nA\u200b Security\tGroup  ',
        industry: '  Data\nsecurity  ',
        size: '   ',
        tenantId: 'attacker-tenant',
        actorId: 'attacker-actor',
        contextType: 'attacker-context',
        completenessScore: 100,
        completenessMetadata: { missingFields: [] },
      })
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith('http://backend.test/advisory/organization-context', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organizationName: 'Tenant A Security Group',
        industry: 'Data security',
      }),
      cache: 'no-store',
    })
    expect(mockFetch.mock.calls[0][1].body).not.toContain('attacker-tenant')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('completenessScore')
  })

  it('forwards malformed PUT bodies as an empty organization name for backend validation', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 400,
      json: async () => ({ message: 'organizationName is required.' }),
    })

    const { PUT } = await import('./route')
    const response = await PUT({
      json: jest.fn(async () => 'not-an-object'),
    } as unknown as Request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ message: 'organizationName is required.' })
    expect(mockFetch).toHaveBeenCalledWith('http://backend.test/advisory/organization-context', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organizationName: '',
      }),
      cache: 'no-store',
    })
  })

  it('drops optional fields that contain only invisible or control characters', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { id: 'context-1' } }),
    })

    const { PUT } = await import('./route')
    const response = await PUT(
      createRequest({
        organizationName: 'Tenant A Security Group',
        industry: '\u200b\u200c',
        size: '\u0000\u200b',
      })
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith('http://backend.test/advisory/organization-context', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organizationName: 'Tenant A Security Group',
      }),
      cache: 'no-store',
    })
  })
})
