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

function createRequest(
  headers: Record<string, string | undefined> = {},
  body: Record<string, unknown> = {}
) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  )

  return {
    headers: {
      get: (name: string) => normalizedHeaders[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  }
}

describe('POST /api/advisory/workflows/:workflowKey/launch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  it('requires a NextAuth session token instead of relaying caller Authorization headers', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { POST } = await import('./route')
    const response = await POST(createRequest({ authorization: 'Bearer caller-token' }) as never, {
      params: { workflowKey: 'brainstorming' },
    })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('proxies workflow launch with the NextAuth session token', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { sessionId: 'session-1' } }),
    })

    const { POST } = await import('./route')
    const response = await POST(createRequest() as never, {
      params: { workflowKey: 'brainstorming' },
    })

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/workflows/brainstorming/launch',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )
  })

  it('proxies accepted Quick Consult recommendation metadata to the backend launch endpoint', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { sessionId: 'session-1' } }),
    })

    const { POST } = await import('./route')
    const response = await POST(
      createRequest(
        {},
        {
          quickConsultContextId: 'quick-consult-context-33',
          acceptedRecommendationId: 'quick-consult-context-33:product-brief:1',
          acceptedRecommendation: true,
          rawProblem: 'drop me',
        }
      ) as never,
      {
        params: { workflowKey: 'product-brief' },
      }
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/workflows/product-brief/launch',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          quickConsultContextId: 'quick-consult-context-33',
          acceptedRecommendationId: 'quick-consult-context-33:product-brief:1',
          acceptedRecommendation: true,
        }),
      })
    )
  })

  it('proxies manual Quick Consult choice metadata while dropping unsafe fields', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { sessionId: 'session-1' } }),
    })

    const { POST } = await import('./route')
    const response = await POST(
      createRequest(
        {},
        {
          quickConsultContextId: 'quick-consult-context-34',
          manualChoice: true,
          manualChoiceKind: 'method',
          manualChoiceId: 'method:design-thinking:empathy-map',
          manualChoiceLabel: 'Empathy Map',
          acceptedRecommendation: true,
          acceptedRecommendationId: 'drop-me',
          rawProblem: 'drop me',
          sourcePath: '_bmad/private.csv',
        }
      ) as never,
      {
        params: { workflowKey: 'design-thinking' },
      }
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/workflows/design-thinking/launch',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          quickConsultContextId: 'quick-consult-context-34',
          manualChoice: true,
          manualChoiceKind: 'method',
          manualChoiceId: 'method:design-thinking:empathy-map',
          manualChoiceLabel: 'Empathy Map',
        }),
      })
    )
  })
})
