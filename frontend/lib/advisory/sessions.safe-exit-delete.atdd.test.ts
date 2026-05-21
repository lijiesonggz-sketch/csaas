import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import * as sessionsClient from './sessions'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>
const mockFetch = jest.fn()

describe('Story 4.7 ATDD RED - ThinkTank session lifecycle client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  test('[P0][4.7-FE-001][AC1] safe-exits a session through an encoded POST without forwarding tenant or actor fields', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session/unsafe id',
          status: 'paused',
          updatedAt: '2026-05-21T01:10:00.000Z',
        },
      }),
    })

    await expect(
      (sessionsClient as Record<string, any>).safeExitThinkTankSession('session/unsafe id', {
        tenantId: 'attacker-tenant',
        actorId: 'attacker-actor',
      }),
    ).resolves.toEqual({
      sessionId: 'session/unsafe id',
      status: 'paused',
      updatedAt: '2026-05-21T01:10:00.000Z',
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/sessions/session%2Funsafe%20id/exit', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
      },
      cache: 'no-store',
    })
    expect(JSON.stringify(mockFetch.mock.calls)).not.toContain('attacker')
  })

  test('[P0][4.7-FE-002][AC2,AC3] deletes a session through an encoded DELETE and normalizes the lifecycle result', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          status: 'deleted',
          outputIds: ['output-1'],
          updatedAt: '2026-05-21T01:11:00.000Z',
        },
      }),
    })

    await expect(
      (sessionsClient as Record<string, any>).deleteThinkTankSession('session-1'),
    ).resolves.toEqual({
      sessionId: 'session-1',
      status: 'deleted',
      outputIds: ['output-1'],
      updatedAt: '2026-05-21T01:11:00.000Z',
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/sessions/session-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer session-token' },
      cache: 'no-store',
    })
  })

  test('[P1][4.7-FE-003][AC2] preserves backend envelope messages for safe-exit and delete failures', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          code: 'THINKTANK_SESSION_LIFECYCLE_FAILED',
          message: '该会话已不可用，请刷新后重试。',
        },
      }),
    })

    await expect(
      (sessionsClient as Record<string, any>).safeExitThinkTankSession('session-1'),
    ).rejects.toThrow('该会话已不可用，请刷新后重试。')
    await expect(
      (sessionsClient as Record<string, any>).deleteThinkTankSession('session-1'),
    ).rejects.toThrow('该会话已不可用，请刷新后重试。')
  })
})
