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

function createRequest(body: unknown) {
  return {
    json: async () => body,
    url: 'http://frontend.test/api/advisory/sessions/session-1/output/knowledge-base',
  } as Request
}

describe('/api/advisory/sessions/:sessionId/output/knowledge-base proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  test('[P0][4.5-FE-005][AC1,AC3] requires auth before forwarding association requests', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const { PUT } = await import('./route')

    const response = await PUT(createRequest({ outputId: 'output-1' }), {
      params: { sessionId: 'session-1' },
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('[P0][4.5-FE-006][AC1,AC3] forwards only safe fields to backend', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          knowledgeBaseAssociation: {
            outputId: 'output-1',
            status: 'pending',
            destinationKey: 'enterprise-knowledge-base',
            externalReferenceId: null,
            message: '知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。',
            retryCount: 1,
            updatedAt: '2026-05-21T08:00:00.000Z',
            associatedAt: null,
          },
        },
      }),
    })
    const { PUT } = await import('./route')

    const response = await PUT(
      createRequest({
        outputId: ' output-1 ',
        destinationKey: ' enterprise-knowledge-base ',
        tenantId: 'evil-tenant',
        userId: 'evil-user',
        title: 'Spoofed title',
        aiMetadata: { rawPrompt: 'secret' },
        contentMarkdown: '# raw',
        sections: [{ contentMarkdown: 'raw section' }],
      }),
      { params: { sessionId: 'session id/with space' } }
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/sessions/session%20id%2Fwith%20space/output/knowledge-base',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outputId: 'output-1',
        }),
        cache: 'no-store',
      }
    )
    expect(mockFetch.mock.calls[0][1].body).not.toContain('evil')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('raw')
  })
})
