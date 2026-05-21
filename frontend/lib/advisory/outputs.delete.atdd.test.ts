import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import * as outputsClient from './outputs'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>
const mockFetch = jest.fn()

describe('Story 4.7 ATDD RED - ThinkTank output delete client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  test('[P0][4.7-FE-004][AC2,AC3] deletes an output through route params only and normalizes the tombstone result', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session/unsafe id',
          outputId: 'output/unsafe id',
          status: 'deleted',
          updatedAt: '2026-05-21T01:12:00.000Z',
        },
      }),
    })

    await expect(
      (outputsClient as Record<string, any>).deleteThinkTankSessionOutput(
        'session/unsafe id',
        'output/unsafe id',
        {
          tenantId: 'attacker-tenant',
          actorId: 'attacker-actor',
          title: 'Do not forward',
        },
      ),
    ).resolves.toEqual({
      sessionId: 'session/unsafe id',
      outputId: 'output/unsafe id',
      status: 'deleted',
      updatedAt: '2026-05-21T01:12:00.000Z',
    })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/advisory/sessions/session%2Funsafe%20id/output/output%2Funsafe%20id',
      {
        method: 'DELETE',
        headers: { Authorization: 'Bearer session-token' },
        cache: 'no-store',
      },
    )
    expect(JSON.stringify(mockFetch.mock.calls)).not.toContain('attacker')
    expect(JSON.stringify(mockFetch.mock.calls)).not.toContain('Do not forward')
  })

  test('[P1][4.7-FE-005][AC2] reports backend output delete failures without clearing local UI state', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          code: 'THINKTANK_OUTPUT_NOT_FOUND',
          message: 'ThinkTank output draft not found.',
        },
      }),
    })

    await expect(
      (outputsClient as Record<string, any>).deleteThinkTankSessionOutput(
        'session-1',
        'output-1',
      ),
    ).rejects.toThrow('ThinkTank output draft not found.')
  })
})
