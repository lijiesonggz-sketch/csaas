import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import {
  fetchThinkTankSessionHistory,
  searchThinkTankHistory,
  THINKTANK_HISTORY_LOAD_FAILED_MESSAGE,
  THINKTANK_HISTORY_SEARCH_FAILED_MESSAGE,
} from './history'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>
const mockFetch = jest.fn()

describe('ThinkTank history client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  test('[P0][4.3-FE-001][AC1] fetches and normalizes filtered history results', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          items: [
            {
              id: 'session-invalid',
              resultType: 'session',
              sessionId: '',
              workflowKey: 'problem-solving',
              workflowType: 'Problem Solving',
              title: 'Invalid',
              summary: '',
              status: 'active',
              timestamp: '2026-05-21T01:08:00.000Z',
              openTarget: 'resume-session',
            },
            {
              id: 'session-1',
              resultType: 'session',
              sessionId: 'session-1',
              workflowKey: 'problem-solving',
              workflowType: 'Problem Solving',
              title: 'Retention Diagnosis',
              summary: '未完成 - Map constraints',
              status: 'active',
              lastStep: { index: 2, label: 'Map constraints', sourceRef: '_bmad/private' },
              timestamp: '2026-05-21T01:06:00.000Z',
              openTarget: 'resume-session',
            },
          ],
          meta: { page: 1, limit: 20, total: 1 },
        },
      }),
    })

    await expect(
      fetchThinkTankSessionHistory({
        type: 'session',
        workflowKey: 'problem-solving',
        status: 'active',
        from: '2026-05-20T00:00:00.000Z',
        to: '2026-05-22T00:00:00.000Z',
        page: 1,
        limit: 20,
        tenantId: 'attacker-tenant',
        actorId: 'attacker-actor',
      } as never),
    ).resolves.toEqual({
      items: [
        {
          id: 'session-1',
          resultType: 'session',
          sessionId: 'session-1',
          workflowKey: 'problem-solving',
          workflowType: 'Problem Solving',
          title: 'Retention Diagnosis',
          summary: '未完成 - Map constraints',
          status: 'active',
          lastStep: { index: 2, label: 'Map constraints' },
          timestamp: '2026-05-21T01:06:00.000Z',
          openTarget: 'resume-session',
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/advisory/sessions/history?type=session&workflowKey=problem-solving&status=active&from=2026-05-20T00%3A00%3A00.000Z&to=2026-05-22T00%3A00%3A00.000Z&page=1&limit=20',
      {
        headers: { Authorization: 'Bearer session-token' },
        cache: 'no-store',
      },
    )
    expect(mockFetch.mock.calls[0][0]).not.toContain('attacker')
  })

  test('[P0][4.3-FE-002][AC2] searches history and keeps output open target fields', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          items: [
            {
              id: 'output-1',
              resultType: 'output',
              sessionId: 'session-1',
              outputId: 'output-1',
              workflowKey: 'problem-solving',
              workflowType: 'Problem Solving',
              title: 'Retention Diagnosis',
              summary: 'Users drop after setup.',
              status: 'completed',
              timestamp: '2026-05-21T01:08:00.000Z',
              openTarget: 'view-output',
            },
          ],
          meta: { page: 1, limit: 20, total: 1 },
        },
      }),
    })

    await expect(
      searchThinkTankHistory({
        q: 'setup guidance',
        type: 'output',
        status: 'completed',
      }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          resultType: 'output',
          outputId: 'output-1',
          workflowType: 'Problem Solving',
          timestamp: '2026-05-21T01:08:00.000Z',
          openTarget: 'view-output',
        }),
      ],
      meta: { page: 1, limit: 20, total: 1 },
    })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/advisory/sessions/search?q=setup+guidance&type=output&status=completed',
      {
        headers: { Authorization: 'Bearer session-token' },
        cache: 'no-store',
      },
    )
  })

  test('[P1][4.3-FE-003][AC1,AC2] surfaces backend errors with stable Chinese fallbacks', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Forbidden' } }),
    })
    await expect(fetchThinkTankSessionHistory()).rejects.toThrow('Forbidden')

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => null,
    })
    await expect(searchThinkTankHistory({ q: 'setup' })).rejects.toThrow(
      THINKTANK_HISTORY_SEARCH_FAILED_MESSAGE,
    )
    expect(THINKTANK_HISTORY_LOAD_FAILED_MESSAGE).toContain('历史')
  })
})
