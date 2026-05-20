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

function createRequest(body: Record<string, unknown> = {}) {
  return {
    json: async () => body,
  }
}

describe('POST /api/advisory/quick-consult/manual-browse', () => {
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
    const response = await POST(createRequest() as never)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('proxies only whitelisted manual browse fields to the backend', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({
        data: {
          workflows: [],
          methodChoices: [],
          methodCatalogStatus: 'available',
        },
      }),
    })

    const { POST } = await import('./route')
    const response = await POST(
      createRequest({
        quickConsultContextId: ' quick-consult-context-34 ',
        tenantId: 'attacker-tenant',
        actorId: 'attacker-actor',
        rawProblem: 'drop me',
      }) as never
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/quick-consult/manual-browse',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quickConsultContextId: 'quick-consult-context-34',
        }),
        cache: 'no-store',
      }
    )
  })
})
