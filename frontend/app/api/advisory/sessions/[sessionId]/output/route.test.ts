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

function createRequest() {
  return {} as Request
}

/*
 * Provider Scrutiny Evidence:
 * - Provider endpoint: backend/src/modules/advisory/sessions/advisory-session.controller.ts -> GET /advisory/sessions/:sessionId/output
 * - Status: expected 200 with { data: { sessionId, output } }, 401 when no NextAuth token, provider errors forwarded as-is.
 * - Fields: output includes id, sessionId, workflowKey, status, title, contentMarkdown, sections, aiLabelMetadata, metadata.
 * - Required headers: Authorization bearer token; Content-Type application/json.
 * - Tenant source: backend CurrentTenant guard only; proxy must not accept tenant from callers.
 */
describe('/api/advisory/sessions/:sessionId/output proxy (ATDD RED)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  test('[P0] exports force-dynamic for the session output route', async () => {
    const route = await import('./route')

    expect(route.dynamic).toBe('force-dynamic')
  })

  test('[P0] requires a NextAuth session token before reading output drafts', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { GET } = await import('./route')
    const response = await GET(createRequest(), { params: { sessionId: 'session-1' } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('[P0] proxies output retrieval with the NextAuth bearer token and encoded session id', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({
        data: {
          sessionId: 'session id/with space',
          output: {
            id: 'output-1',
            sections: [],
            aiLabelMetadata: { visible_label: '[AI Generated]' },
          },
        },
      }),
    })

    const { GET } = await import('./route')
    const response = await GET(createRequest(), {
      params: { sessionId: 'session id/with space' },
    })

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/sessions/session%20id%2Fwith%20space/output',
      {
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )
  })

  test('[P0] forwards backend output errors without inventing cross-tenant metadata', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 404,
      json: async () => ({
        error: {
          code: 'THINKTANK_OUTPUT_NOT_FOUND',
          message: 'ThinkTank output draft not found.',
        },
      }),
    })

    const { GET } = await import('./route')
    const response = await GET(createRequest(), { params: { sessionId: 'foreign-session' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: {
        code: 'THINKTANK_OUTPUT_NOT_FOUND',
        message: 'ThinkTank output draft not found.',
      },
    })
  })
})
