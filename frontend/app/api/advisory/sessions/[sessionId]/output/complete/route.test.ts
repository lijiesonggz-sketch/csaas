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

/*
 * Provider Scrutiny Evidence:
 * - Provider endpoint: backend/src/modules/advisory/sessions/advisory-session.controller.ts -> POST /advisory/sessions/:sessionId/output/complete
 * - Status: expected 200 with { data: { sessionId, output } }; 404/409 provider errors forwarded.
 * - Request fields: outcome only. Completion audit metadata is built by backend, not by caller body.
 * - Required headers: Authorization bearer token; Content-Type application/json.
 * - Privacy: proxy must not relay raw report content, sections, tenantId, outputId, or audit metadata.
 */
describe('/api/advisory/sessions/:sessionId/output/complete proxy (ATDD RED)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  test('[P0] exports force-dynamic for output completion requests', async () => {
    const route = await import('./route')

    expect(route.dynamic).toBe('force-dynamic')
  })

  test('[P0] requires a NextAuth session token before completing output drafts', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { POST } = await import('./route')
    const response = await POST(createRequest({ outcome: 'success' }), {
      params: { sessionId: 'session-1' },
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('[P0] proxies completion using only the outcome and strips caller-supplied raw report/audit fields', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          output: {
            id: 'output-1',
            status: 'completed',
            aiLabelMetadata: { visible_label: '[AI Generated]' },
          },
        },
      }),
    })

    const { POST } = await import('./route')
    const response = await POST(
      createRequest({
        tenantId: 'attacker-tenant',
        outputId: 'attacker-output',
        outcome: 'success',
        contentMarkdown: 'raw report body should not be forwarded',
        sections: [{ contentMarkdown: 'raw section body should not be forwarded' }],
        metadata: {
          report: 'raw report should not be forwarded',
          document: 'raw document should not be forwarded',
        },
      }),
      { params: { sessionId: 'session-1' } }
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/sessions/session-1/output/complete',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ outcome: 'success' }),
        cache: 'no-store',
      }
    )
    expect(mockFetch.mock.calls[0][1].body).not.toContain('attacker-tenant')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('raw report')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('sections')
  })

  test('[P0] forwards backend completion conflict errors without leaking output metadata', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 409,
      json: async () => ({
        error: {
          code: 'THINKTANK_OUTPUT_ALREADY_COMPLETED',
          message: 'ThinkTank output is already completed.',
        },
      }),
    })

    const { POST } = await import('./route')
    const response = await POST(createRequest({ outcome: 'success' }), {
      params: { sessionId: 'session-1' },
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: {
        code: 'THINKTANK_OUTPUT_ALREADY_COMPLETED',
        message: 'ThinkTank output is already completed.',
      },
    })
  })
})
