import { apiFetch, clearTokenCache, getAuthToken } from '../api'

const mockFetch = jest.fn()

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('auth token cache', () => {
  const originalFetch = global.fetch
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL

  beforeEach(() => {
    jest.clearAllMocks()
    clearTokenCache()
    global.fetch = mockFetch
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test'
  })

  afterAll(() => {
    global.fetch = originalFetch
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl
  })

  it('does not cache a missing token', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ user: null, accessToken: null }))
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'fresh-token' }))

    await expect(getAuthToken()).resolves.toBeNull()
    await expect(getAuthToken()).resolves.toBe('fresh-token')

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('fetches a fresh token for apiFetch after a previous unauthenticated lookup', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ user: null, accessToken: null }))
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: [] }))

    await expect(getAuthToken()).resolves.toBeNull()
    await expect(apiFetch('/projects')).resolves.toEqual([])

    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/auth/session')
    expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/auth/session')

    const [, requestInit] = mockFetch.mock.calls[2] as [string, RequestInit]
    expect(mockFetch.mock.calls[2][0]).toBe('http://api.test/projects')
    expect(new Headers(requestInit.headers).get('Authorization')).toBe('Bearer fresh-token')
  })
})
