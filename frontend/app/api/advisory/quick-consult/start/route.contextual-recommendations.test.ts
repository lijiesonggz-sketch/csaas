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

describe('POST /api/advisory/quick-consult/start contextual recommendation proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = mockFetch
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  it('[P0][3.7-FE-002][AC1][AC2] forwards only trusted request fields and never caller-supplied enterprise signal identity', async () => {
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({
        data: {
          contextId: 'quick-consult-context-37',
          status: 'analysis_started',
          recommendationContext: {
            mode: 'enterprise',
            signalsApplied: ['it_maturity'],
            sources: ['csaas_it_maturity'],
          },
          enterpriseContext: {
            mode: 'enterprise',
            signalsApplied: ['it_maturity'],
            sources: ['csaas_it_maturity'],
          },
        },
      }),
    })

    const { POST } = await import('./route')
    const response = await POST(
      createRequest({
        problem: 'Assess ISO 27001 remediation priorities.',
        contextId: '550e8400-e29b-41d4-a716-446655440037',
        originalProblem: 'Assess ISO 27001 remediation priorities.',
        clarificationAnswers: [
          {
            question: 'Which compliance scope matters most?',
            answer: 'ISO 27001 access-control remediation.',
            tenantId: 'tenant-b',
            organizationId: 'org-b',
            maturitySignals: ['raw-maturity-leak'],
            complianceSignals: ['raw-compliance-leak'],
          },
        ],
        tenantId: 'tenant-b',
        organizationId: 'org-b',
        csaasSignals: { rawQuestionnaireAnswer: 'must not forward' },
        maturityData: { overallMaturity: 'tenant-b-secret' },
        complianceData: { gap: 'tenant-b-gap' },
        recommendationContext: { mode: 'enterprise', signalsApplied: ['attacker-signal'] },
        enterpriseContext: { mode: 'enterprise', signalsApplied: ['attacker-signal'] },
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
        contextId: '550e8400-e29b-41d4-a716-446655440037',
        originalProblem: 'Assess ISO 27001 remediation priorities.',
        clarificationAnswers: [
          {
            question: 'Which compliance scope matters most?',
            answer: 'ISO 27001 access-control remediation.',
          },
        ],
      }),
      cache: 'no-store',
    })

    const forwardedBody = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(Object.keys(forwardedBody).sort()).toEqual([
      'clarificationAnswers',
      'contextId',
      'originalProblem',
      'problem',
    ])
    expect(forwardedBody.clarificationAnswers).toEqual([
      {
        question: 'Which compliance scope matters most?',
        answer: 'ISO 27001 access-control remediation.',
      },
    ])
    expect(JSON.stringify(forwardedBody)).not.toMatch(
      /tenant-b|org-b|csaasSignals|maturityData|complianceData|recommendationContext|enterpriseContext|raw-maturity-leak|raw-compliance-leak|tenant-b-secret|tenant-b-gap|attacker-signal/
    )
    await expect(response.json()).resolves.toMatchObject({
      data: {
        recommendationContext: {
          mode: 'enterprise',
          signalsApplied: ['it_maturity'],
          sources: ['csaas_it_maturity'],
        },
        enterpriseContext: {
          mode: 'enterprise',
          signalsApplied: ['it_maturity'],
          sources: ['csaas_it_maturity'],
        },
      },
    })
  })
})
