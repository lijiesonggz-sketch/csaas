import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { fetchThinkTankSessionHistory } from './history'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>
const mockFetch = jest.fn()

describe('ThinkTank history asset state normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  test('[P0][4.4-FE-005][AC2,AC3] preserves current user favorite state on history report items', async () => {
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
              assetState: {
                outputId: 'output-1',
                rating: 5,
                feedbackTextPresent: true,
                isFavorited: true,
                updatedAt: '2026-05-21T06:10:00.000Z',
              },
            },
          ],
          meta: { page: 1, limit: 20, total: 1 },
        },
      }),
    })

    await expect(fetchThinkTankSessionHistory({ type: 'output' })).resolves.toEqual({
      items: [
        expect.objectContaining({
          outputId: 'output-1',
          assetState: {
            outputId: 'output-1',
            rating: 5,
            feedbackTextPresent: true,
            isFavorited: true,
            updatedAt: '2026-05-21T06:10:00.000Z',
          },
        }),
      ],
      meta: { page: 1, limit: 20, total: 1 },
    })
  })
})
