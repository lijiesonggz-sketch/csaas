import { getServerSession } from 'next-auth'

jest.mock('next/server', () => ({
  NextRequest: class NextRequest {},
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

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return an empty session payload with 200 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { GET } = await import('./route')
    const response = await GET({} as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      user: null,
      accessToken: null,
      expires: null,
    })
  })
})
