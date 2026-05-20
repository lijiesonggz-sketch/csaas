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
 * - Provider endpoint: backend/src/modules/advisory/sessions/advisory-session.controller.ts -> POST /advisory/sessions/:sessionId/output/sections
 * - Status: expected 200 with { data: { sessionId, output, section } }; 4xx/5xx provider payloads forwarded.
 * - Request fields: stepIndex, stepLabel, contentMarkdown, sourceMessageId, providerMetadata with safe provider/model/latency fields only.
 * - Required headers: Authorization bearer token; Content-Type application/json.
 * - Tenant source: backend CurrentTenant guard only; proxy strips tenantId/outputId and unsafe raw prompt/report fields.
 */
describe('/api/advisory/sessions/:sessionId/output/sections proxy (ATDD RED)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  test('[P0] exports force-dynamic for append-section requests', async () => {
    const route = await import('./route')

    expect(route.dynamic).toBe('force-dynamic')
  })

  test('[P0] requires a NextAuth session token before appending output sections', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { POST } = await import('./route')
    const response = await POST(createRequest({ contentMarkdown: 'Hello' }), {
      params: { sessionId: 'session-1' },
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('[P0] proxies section append while stripping caller-supplied tenant, output, and unsafe provider fields', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          output: {
            id: 'output-1',
            sections: [
              {
                id: 'section-1',
                aiLabel: '[AI Generated]',
              },
            ],
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
        stepIndex: 1,
        stepLabel: 'Diagnose retention',
        contentMarkdown: 'Retention drops after the second session.',
        sourceMessageId: 'assistant-message-1',
        providerMetadata: {
          provider: 'fake',
          model: 'fake-thinktank-model',
          latencyMs: 12,
          rawPrompt: 'do not forward',
          rawReportContent: 'do not forward',
        },
        aiLabelMetadata: { tenantId: 'attacker-tenant' },
      }),
      { params: { sessionId: 'session-1' } }
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/sessions/session-1/output/sections',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stepIndex: 1,
          stepLabel: 'Diagnose retention',
          contentMarkdown: 'Retention drops after the second session.',
          sourceMessageId: 'assistant-message-1',
          providerMetadata: {
            provider: 'fake',
            model: 'fake-thinktank-model',
            latencyMs: 12,
          },
        }),
        cache: 'no-store',
      }
    )
    expect(mockFetch.mock.calls[0][1].body).not.toContain('attacker-tenant')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('rawPrompt')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('rawReportContent')
  })

  test('[P0] forwards backend append validation errors with safe error envelopes', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 422,
      json: async () => ({
        error: {
          code: 'THINKTANK_OUTPUT_SECTION_INVALID',
          message: 'Output section content is required.',
        },
      }),
    })

    const { POST } = await import('./route')
    const response = await POST(createRequest({ contentMarkdown: '' }), {
      params: { sessionId: 'session-1' },
    })

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      error: {
        code: 'THINKTANK_OUTPUT_SECTION_INVALID',
        message: 'Output section content is required.',
      },
    })
  })
})
