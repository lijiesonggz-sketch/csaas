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

describe('POST /api/advisory/quick-consult/start', () => {
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
    const response = await POST(createRequest({ problem: 'Assess compliance risk.' }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ message: 'No access token' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('proxies only the problem field and ignores caller-supplied tenant context', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { contextId: 'quick-consult-1', status: 'analysis_started' } }),
    })

    const { POST } = await import('./route')
    const response = await POST(
      createRequest({
        tenantId: 'attacker-tenant',
        auditMetadata: { content: 'do not forward' },
        problem: 'Assess ISO 27001 remediation priorities.',
      })
    )

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledWith('http://backend.test/advisory/quick-consult/start', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        problem: 'Assess ISO 27001 remediation priorities.',
      }),
      cache: 'no-store',
    })
    expect(mockFetch.mock.calls[0][1].body).not.toContain('attacker-tenant')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('auditMetadata')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('do not forward')
  })

  it('forwards whitelisted clarification context without tenant or audit metadata', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ data: { contextId: 'quick-consult-1', status: 'analysis_started' } }),
    })

    const { POST } = await import('./route')
    await POST(
      createRequest({
        tenantId: 'attacker-tenant',
        auditMetadata: { prompt: 'do not forward' },
        problem: 'Help me with AI.',
        contextId: '550e8400-e29b-41d4-a716-446655440001',
        originalProblem: 'Help me with AI.',
        clarificationAnswers: [
          {
            question: 'What business decision are you trying to make?',
            answer: 'Prioritize enterprise compliance onboarding.',
          },
          { question: '', answer: 'drop me' },
        ],
      })
    )

    expect(mockFetch.mock.calls[0][1].body).toEqual(
      JSON.stringify({
        problem: 'Help me with AI.',
        contextId: '550e8400-e29b-41d4-a716-446655440001',
        originalProblem: 'Help me with AI.',
        clarificationAnswers: [
          {
            question: 'What business decision are you trying to make?',
            answer: 'Prioritize enterprise compliance onboarding.',
          },
        ],
      })
    )
    expect(mockFetch.mock.calls[0][1].body).not.toContain('attacker-tenant')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('auditMetadata')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('prompt')
  })
})
