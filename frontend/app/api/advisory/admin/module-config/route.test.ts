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

function createRequest(headers: Record<string, string | undefined> = {}, body = '') {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  )

  return {
    headers: {
      get: (name: string) => normalizedHeaders[name.toLowerCase()] ?? null,
    },
    text: jest.fn().mockResolvedValue(body),
  }
}

describe('/api/advisory/admin/module-config proxy route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ data: { id: 'config-1', moduleKey: 'thinktank' } }),
    })
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  it('forwards GET module config with the request authorization header', async () => {
    const { GET } = await import('./route')
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })

    const response = await GET(
      createRequest({ authorization: 'Bearer request-token' }) as never
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ data: { id: 'config-1', moduleKey: 'thinktank' } })
    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/admin/module-config',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer request-token',
          'Content-Type': 'application/json',
        }),
        cache: 'no-store',
      })
    )
  })

  it('forwards PUT module config with the session token and request body', async () => {
    const { PUT } = await import('./route')
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    const requestBody = JSON.stringify({
      enabled: true,
      allowedRoles: ['admin'],
      dataRetentionDays: 90,
      privacyConfirmed: true,
    })

    const response = await PUT(createRequest({}, requestBody) as never)

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/admin/module-config',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        }),
        body: requestBody,
        cache: 'no-store',
      })
    )
  })

  it('returns 401 when no authorization source exists', async () => {
    const { GET } = await import('./route')
    mockGetServerSession.mockResolvedValue(null)

    const response = await GET(createRequest() as never)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ message: 'No access token' })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
