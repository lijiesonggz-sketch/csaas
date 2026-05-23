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

function createRequest(url: string, headers: Record<string, string | undefined> = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  )

  return {
    url,
    headers: {
      get: (name: string) => normalizedHeaders[name.toLowerCase()] ?? null,
    },
  }
}

describe('/api/advisory/admin/operations/governance proxy route ATDD (RED)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { freshness: { status: 'fresh' } } }),
    })
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  it('[6.5-PROXY-001][P1][AC1] forwards only safe governance filters and strips tenantId=current', async () => {
    const { GET } = (await import('./route')) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })

    const response = await GET(
      createRequest(
        'http://frontend.test/api/advisory/admin/operations/governance?tenantId=current&dateFrom=2026-05-01&dateTo=2026-05-22&workflowType=problem-solving&actorId=actor-42&eventType=thinktank.output.exported&outcome=denied&groupBy=eventType,outcome,actor,workflow&rawPrompt=PRIVATE_PROMPT&reportContent=PRIVATE_REPORT',
        { authorization: 'Bearer request-token' }
      ) as never
    )

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/admin/operations/governance?dateFrom=2026-05-01&dateTo=2026-05-22&workflowType=problem-solving&actorId=actor-42&eventType=thinktank.output.exported&outcome=denied&groupBy=eventType%2Coutcome%2Cactor%2Cworkflow',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer request-token',
          'Content-Type': 'application/json',
        }),
        cache: 'no-store',
      })
    )
  })

  it('[6.5-PROXY-002][P0][AC1,AC3] rejects duplicate governance query params before proxying', async () => {
    const { GET } = (await import('./route')) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })

    for (const filterName of [
      'tenantId',
      'dateFrom',
      'dateTo',
      'workflowType',
      'actorId',
      'eventType',
      'outcome',
      'groupBy',
    ]) {
      const response = await GET(
        createRequest(
          `http://frontend.test/api/advisory/admin/operations/governance?${filterName}=first&${filterName}=second`
        ) as never
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        message: 'Invalid or duplicate filter parameter',
      })
    }

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('[6.5-PROXY-003][P0][AC1,AC4] rejects unsafe values in allowlisted governance filters', async () => {
    const { GET } = (await import('./route')) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })

    for (const query of [
      'actorId=PRIVATE_CONVERSATION_DO_NOT_RENDER',
      'workflowType=raw%20prompt',
      'eventType=thinktank.output.exported.prompt',
      'outcome=report%20content',
      'actorId=full_profile',
      'groupBy=eventType,prompt',
    ]) {
      const response = await GET(
        createRequest(
          `http://frontend.test/api/advisory/admin/operations/governance?${query}`
        ) as never
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        message: 'Invalid or duplicate filter parameter',
      })
    }

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('[6.5-PROXY-004][P0][AC1] does not forward backend non-2xx governance-shaped data bodies', async () => {
    const { GET } = (await import('./route')) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 403,
      ok: false,
      json: async () => ({
        data: {
          summary: { measurementStatus: 'fresh', totalEvents: 99 },
          byEventType: [{ eventName: 'thinktank.output.exported', count: 99 }],
        },
      }),
    })

    const response = await GET(
      createRequest('http://frontend.test/api/advisory/admin/operations/governance') as never
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      message: 'Governance review unavailable. No trusted measurements are available.',
    })
  })
})
