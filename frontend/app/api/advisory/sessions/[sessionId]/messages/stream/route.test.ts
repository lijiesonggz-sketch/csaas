import { getServerSession } from 'next-auth'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth/auth-options', () => ({
  authOptions: {},
}))

const mockGetServerSession = getServerSession as jest.Mock
const mockFetch = jest.fn()

function createStreamingRequest(body: unknown) {
  return {
    json: jest.fn(async () => body),
    signal: new AbortController().signal,
  } as unknown as Request
}

describe('/api/advisory/sessions/:sessionId/messages/stream proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  test('[P0] requires a NextAuth session token before opening the stream', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { POST } = await import('./route')
    const response = await POST(createStreamingRequest({ content: 'Hello' }), {
      params: { sessionId: 'session-1' },
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('[P0] forwards backend SSE bytes and strips caller-supplied tenant fields', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('event: message.delta\ndata: {"delta":"hello"}\n\n')
        )
        controller.close()
      },
    })
    mockFetch.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
        },
      })
    )

    const { POST } = await import('./route')
    const request = createStreamingRequest({
      content: 'Please stream this response.',
      decisionAction: 'deepen',
      tenantId: 'attacker-tenant',
    })
    const response = await POST(request, { params: { sessionId: 'session-1' } })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8')
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform')
    expect(await response.text()).toContain('event: message.delta')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/sessions/session-1/messages/stream',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          content: 'Please stream this response.',
          decisionAction: 'deepen',
        }),
        cache: 'no-store',
        signal: request.signal,
      }
    )
  })

  test('[P1] converts backend stream startup failures to a safe JSON error', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Backend unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const { POST } = await import('./route')
    const response = await POST(createStreamingRequest({ content: 'Hello' }), {
      params: { sessionId: 'session-1' },
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ message: 'Backend unavailable' })
  })
})
