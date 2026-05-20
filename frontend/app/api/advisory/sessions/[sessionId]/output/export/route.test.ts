import { getServerSession } from 'next-auth'

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
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

function createRequest(format: string) {
  return {
    url: `http://frontend.test/api/advisory/sessions/session-1/output/export?format=${format}`,
  } as Request
}

function createBackendResponse({
  status,
  headers,
  body,
}: {
  status: number
  headers: Record<string, string>
  body: string | Buffer
}): Response {
  return {
    status,
    headers: new Headers(headers),
    arrayBuffer: jest.fn(async () => {
      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body)
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    }),
  } as unknown as Response
}

async function readResponseText(response: Response): Promise<string> {
  const body = (response as unknown as { body?: unknown }).body

  if (body && typeof body === 'object' && typeof (body as ArrayBuffer).byteLength === 'number') {
    return Buffer.from(body).toString('utf8')
  }

  return response.text()
}

/*
 * Provider endpoint: backend/src/modules/advisory/sessions/advisory-session.controller.ts
 * Expected route: GET /advisory/sessions/:sessionId/output/export?format=markdown|pdf
 * Provider scrutiny evidence:
 * - Status: 200 binary/text passthrough, 401 without session token, backend 4xx/5xx forwarded.
 * - Response fields: no JSON envelope on success; Content-Type and Content-Disposition preserved.
 * - Privacy: proxy forwards only bearer token and query format; no tenant/output/report/audit body.
 */
describe('/api/advisory/sessions/:sessionId/output/export proxy (ATDD RED)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  test('[P0] exports force-dynamic for output export requests', async () => {
    const route = await import('./route')

    expect(route.dynamic).toBe('force-dynamic')
  })

  test('[P0] requires a NextAuth token before requesting backend exports', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const { GET } = await import('./route')

    const response = await GET(createRequest('markdown'), { params: { sessionId: 'session-1' } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('[P0] forwards Markdown exports as text with backend download headers intact', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue(
      createBackendResponse({
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': 'attachment; filename="thinktank-report-session-1.md"',
        },
        body: '# Report\n\n[AI Generated]',
      })
    )
    const { GET } = await import('./route')

    const response = await GET(createRequest('markdown'), {
      params: { sessionId: 'session id/with space' },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/sessions/session%20id%2Fwith%20space/output/export?format=markdown',
      {
        headers: { Authorization: 'Bearer session-token' },
        cache: 'no-store',
      }
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="thinktank-report-session-1.md"'
    )
    await expect(readResponseText(response)).resolves.toContain('[AI Generated]')
  })

  test('[P0] forwards PDF exports as binary without a JSON wrapper', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue(
      createBackendResponse({
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="thinktank-report-session-1.pdf"',
        },
        body: Buffer.from('%PDF-1.4\n'),
      })
    )
    const { GET } = await import('./route')

    const response = await GET(createRequest('pdf'), { params: { sessionId: 'session-1' } })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="thinktank-report-session-1.pdf"'
    )
    await expect(readResponseText(response)).resolves.toContain('%PDF-1.4')
  })

  test('[P1] preserves backend export error status and message for recoverable UI alerts', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue(
      createBackendResponse({
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            code: 'THINKTANK_OUTPUT_EMPTY',
            message: '报告至少需要一个章节后才能导出。',
          },
        }),
      })
    )
    const { GET } = await import('./route')

    const response = await GET(createRequest('markdown'), { params: { sessionId: 'session-1' } })

    expect(response.status).toBe(400)
    expect(JSON.parse(await readResponseText(response))).toEqual({
      error: {
        code: 'THINKTANK_OUTPUT_EMPTY',
        message: '报告至少需要一个章节后才能导出。',
      },
    })
  })

  test('[P1] returns recoverable guidance when the backend export request fails', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockRejectedValueOnce(new Error('backend unavailable'))
    const { GET } = await import('./route')

    const response = await GET(createRequest('pdf'), { params: { sessionId: 'session-1' } })

    expect(response.status).toBe(500)
    expect(JSON.parse(await readResponseText(response))).toEqual({
      message: '报告导出失败，请重试；如果仍失败，请检查网络或联系管理员。',
    })
  })
})
