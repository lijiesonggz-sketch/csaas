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

describe('/api/advisory/admin/operations/provider-telemetry proxy route ATDD (Story 6.3 RED)', () => {
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

  it('[6.3-API-001][P1][AC1] forwards provider telemetry with whitelisted filters and request authorization', async () => {
    const routeModulePath = './route'
    const { GET } = (await import(routeModulePath)) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })

    const response = await GET(
      createRequest(
        'http://frontend.test/api/advisory/admin/operations/provider-telemetry?tenantId=current&dateFrom=2026-05-01&dateTo=2026-05-22&workflowType=problem-solving&groupBy=workflow,experience,provider&actorId=malicious&rawPrompt=PRIVATE_PROMPT',
        { authorization: 'Bearer request-token' }
      ) as never
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ data: { freshness: { status: 'fresh' } } })
    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/advisory/admin/operations/provider-telemetry?dateFrom=2026-05-01&dateTo=2026-05-22&workflowType=problem-solving&groupBy=workflow%2Cexperience%2Cprovider',
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

  it('[6.3-API-002][P1][AC1,AC2] rejects duplicate provider telemetry filters before proxying', async () => {
    const routeModulePath = './route'
    const { GET } = (await import(routeModulePath)) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }
    mockGetServerSession.mockResolvedValue({ accessToken: 'session-token' })

    const duplicatedFilters = ['tenantId', 'dateFrom', 'dateTo', 'workflowType', 'groupBy']

    for (const filterName of duplicatedFilters) {
      const response = await GET(
        createRequest(
          `http://frontend.test/api/advisory/admin/operations/provider-telemetry?${filterName}=first&${filterName}=second`
        ) as never
      )
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ message: 'Duplicate filter parameter' })
    }

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('[6.3-API-003][P1][AC2,AC3] handles auth and upstream provider telemetry failures without rewriting bodies', async () => {
    const routeModulePath = './route'
    const { GET } = (await import(routeModulePath)) as {
      GET: (request: never) => Promise<{ status: number; json(): Promise<unknown> }>
    }

    mockGetServerSession.mockResolvedValueOnce(null)
    const unauthorized = await GET(
      createRequest(
        'http://frontend.test/api/advisory/admin/operations/provider-telemetry'
      ) as never
    )
    expect(unauthorized.status).toBe(401)
    await expect(unauthorized.json()).resolves.toEqual({ message: 'No access token' })

    mockGetServerSession.mockResolvedValueOnce({ accessToken: 'session-token' })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 403,
      json: async () => ({ message: '当前账号无权查看其他租户的 ThinkTank 运营数据。' }),
    })

    const forbidden = await GET(
      createRequest(
        'http://frontend.test/api/advisory/admin/operations/provider-telemetry?tenantId=tenant-forbidden'
      ) as never
    )
    expect(forbidden.status).toBe(403)
    await expect(forbidden.json()).resolves.toEqual({
      message: '当前账号无权查看其他租户的 ThinkTank 运营数据。',
    })

    mockGetServerSession.mockResolvedValueOnce({ accessToken: 'session-token' })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 503,
      json: async () => ({
        data: {
          summary: { measurementStatus: 'unavailable' },
          freshness: {
            status: 'unavailable',
            latestEventAt: null,
            description:
              'Provider telemetry source is unavailable. No trusted measurements are available.',
          },
        },
      }),
    })

    const unavailable = await GET(
      createRequest(
        'http://frontend.test/api/advisory/admin/operations/provider-telemetry'
      ) as never
    )
    expect(unavailable.status).toBe(503)
    await expect(unavailable.json()).resolves.toEqual({
      data: {
        summary: { measurementStatus: 'unavailable' },
        freshness: {
          status: 'unavailable',
          latestEventAt: null,
          description:
            'Provider telemetry source is unavailable. No trusted measurements are available.',
        },
      },
    })
  })
})
