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

describe('/api/advisory/admin/operations/quality-feedback proxy route (Story 6.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.INTERNAL_API_URL = 'http://backend.test'
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ data: { freshness: { status: 'fresh' } } }),
    })
  })

  afterEach(() => {
    delete process.env.INTERNAL_API_URL
  })

  it('[6.4-API-001][P1][AC1,AC3] forwards quality feedback with whitelisted filters and request authorization', async () => {
    const routeModulePath = './route'
    const { GET } = (await import(routeModulePath)) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })

    const response = await GET(
      createRequest(
        'http://frontend.test/api/advisory/admin/operations/quality-feedback?tenantId=current&dateFrom=2026-05-01&dateTo=2026-05-22&workflowType=problem-solving&recommendationType=risk-mitigation&groupBy=workflow,recommendationType&timeBucket=day&actorId=malicious&rawFeedback=PRIVATE_FEEDBACK',
        { authorization: 'Bearer request-token' }
      ) as never
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ data: { freshness: { status: 'fresh' } } })
    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/admin/operations/quality-feedback?dateFrom=2026-05-01&dateTo=2026-05-22&workflowType=problem-solving&recommendationType=risk-mitigation&groupBy=workflow%2CrecommendationType&timeBucket=day',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token',
          'Content-Type': 'application/json',
        }),
        cache: 'no-store',
      })
    )
  })

  it('[6.4-API-002][P0][AC3] strips tenantId=current before backend forwarding', async () => {
    const routeModulePath = './route'
    const { GET } = (await import(routeModulePath)) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })

    await GET(
      createRequest(
        'http://frontend.test/api/advisory/admin/operations/quality-feedback?tenantId=current'
      ) as never
    )

    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).not.toContain('tenantId=current')
  })

  it('[6.4-API-003][P0][AC1,AC3] rejects duplicate whitelisted query params before proxying', async () => {
    const routeModulePath = './route'
    const { GET } = (await import(routeModulePath)) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })

    const duplicatedFilters = [
      'tenantId',
      'dateFrom',
      'dateTo',
      'workflowType',
      'recommendationType',
      'groupBy',
      'timeBucket',
    ]

    for (const filterName of duplicatedFilters) {
      const response = await GET(
        createRequest(
          `http://frontend.test/api/advisory/admin/operations/quality-feedback?${filterName}=first&${filterName}=second`
        ) as never
      )
      await expect(response.json()).resolves.toEqual({ message: 'Duplicate filter parameter' })
      expect(response.status).toBe(400)
    }

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('[6.4-API-004][P1][AC1] ignores unsafe quality query params', async () => {
    const routeModulePath = './route'
    const { GET } = (await import(routeModulePath)) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })

    await GET(
      createRequest(
        'http://frontend.test/api/advisory/admin/operations/quality-feedback?actorId=a&userId=u&rawFeedback=PRIVATE&feedbackText=PRIVATE&prompt=PRIVATE&conversation=PRIVATE&reportContent=PRIVATE&workflowType=problem-solving'
      ) as never
    )

    const backendUrl = String((global.fetch as jest.Mock).mock.calls[0][0])
    expect(backendUrl).toContain('workflowType=problem-solving')
    expect(backendUrl).not.toMatch(
      /actorId|userId|rawFeedback|feedbackText|prompt|conversation|reportContent|PRIVATE/
    )
  })

  it('[6.4-API-005][P1][AC3] propagates upstream tenant-denied status and body unchanged', async () => {
    const routeModulePath = './route'
    const { GET } = (await import(routeModulePath)) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 403,
      json: async () => ({ message: '当前账号无权查看其他租户的 ThinkTank 运营数据。' }),
    })

    const response = await GET(
      createRequest(
        'http://frontend.test/api/advisory/admin/operations/quality-feedback?tenantId=tenant-forbidden'
      ) as never
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      message: '当前账号无权查看其他租户的 ThinkTank 运营数据。',
    })
  })

  it('[6.4-API-006][P1][AC1,AC2] propagates upstream unavailable quality body and status unchanged', async () => {
    const routeModulePath = './route'
    const { GET } = (await import(routeModulePath)) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 503,
      json: async () => ({
        data: {
          summary: { measurementStatus: 'unavailable' },
          freshness: {
            status: 'unavailable',
            latestEventAt: null,
            description: 'Quality feedback unavailable. No trusted measurements are available.',
          },
        },
      }),
    })

    const response = await GET(
      createRequest('http://frontend.test/api/advisory/admin/operations/quality-feedback') as never
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      data: {
        summary: { measurementStatus: 'unavailable' },
        freshness: {
          status: 'unavailable',
          latestEventAt: null,
          description: 'Quality feedback unavailable. No trusted measurements are available.',
        },
      },
    })
  })

  it('[6.4-API-007][P1][AC3] returns 401 when no request authorization and no session token exist', async () => {
    const routeModulePath = './route'
    const { GET } = (await import(routeModulePath)) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }
    mockGetServerSession.mockResolvedValue(null)

    const response = await GET(
      createRequest('http://frontend.test/api/advisory/admin/operations/quality-feedback') as never
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ message: 'No access token' })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
