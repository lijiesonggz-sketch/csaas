import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import {
  THINKTANK_OUTPUT_FAVORITE_REQUIRED_MESSAGE,
  THINKTANK_OUTPUT_RATING_REQUIRED_MESSAGE,
  fetchThinkTankOutputAssetState,
  fetchThinkTankSessionOutput,
  rateThinkTankSessionOutput,
  updateThinkTankOutputFavorite,
} from './outputs'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>
const mockFetch = jest.fn()

function createOutputEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    id: 'output-1',
    sessionId: 'session-1',
    workflowKey: 'problem-solving',
    status: 'completed',
    title: 'Retention Diagnosis',
    summary: 'Users drop after setup.',
    contentMarkdown: '# Retention Diagnosis',
    sections: [
      {
        id: 'section-1',
        stepIndex: 1,
        heading: 'Diagnose retention',
        contentMarkdown: '[AI Generated]\n\nUsers drop after setup.',
        aiLabel: '[AI Generated]',
        metadata: {},
      },
    ],
    aiLabelMetadata: {
      visible_label: '[AI Generated]',
      ai_generated: true,
      machine_readable: true,
    },
    metadata: {},
    assetState: {
      outputId: 'output-1',
      rating: 4,
      feedbackTextPresent: true,
      isFavorited: true,
      updatedAt: '2026-05-21T06:00:00.000Z',
    },
    ...overrides,
  }
}

describe('ThinkTank output rating and favorite client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  test('[P0][4.4-FE-001][AC1,AC2] preserves output asset state when loading a report', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          output: createOutputEnvelope(),
        },
      }),
    })

    await expect(fetchThinkTankSessionOutput('session-1')).resolves.toEqual({
      sessionId: 'session-1',
      output: expect.objectContaining({
        id: 'output-1',
        assetState: {
          outputId: 'output-1',
          rating: 4,
          feedbackTextPresent: true,
          isFavorited: true,
          updatedAt: '2026-05-21T06:00:00.000Z',
        },
      }),
    })
  })

  test('[P0][4.4-FE-002][AC1,AC4] submits rating through a safe body whitelist', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          assetState: {
            outputId: 'output-1',
            rating: 5,
            feedbackTextPresent: true,
            isFavorited: false,
            updatedAt: '2026-05-21T06:05:00.000Z',
          },
        },
      }),
    })

    await expect(
      rateThinkTankSessionOutput('session-1', {
        outputId: ' output-1 ',
        rating: 5,
        feedbackText: '  高管摘要很有帮助  ',
        tenantId: 'attacker-tenant',
        actorId: 'attacker-actor',
        contentMarkdown: 'raw report body',
      } as never)
    ).resolves.toEqual({
      sessionId: 'session-1',
      assetState: {
        outputId: 'output-1',
        rating: 5,
        feedbackTextPresent: true,
        isFavorited: false,
        updatedAt: '2026-05-21T06:05:00.000Z',
      },
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/sessions/session-1/output/rating', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outputId: 'output-1',
        rating: 5,
        feedbackText: '高管摘要很有帮助',
      }),
      cache: 'no-store',
    })
    expect(mockFetch.mock.calls[0][1].body).not.toContain('attacker')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('raw report')
  })

  test.each([undefined, null, 0, 6, 3.5, '5'])(
    '[P0][4.4-FE-003][AC1] rejects invalid rating value %p before fetch',
    async (rating) => {
      await expect(
        rateThinkTankSessionOutput('session-1', { outputId: 'output-1', rating } as never)
      ).rejects.toThrow(THINKTANK_OUTPUT_RATING_REQUIRED_MESSAGE)

      expect(mockFetch).not.toHaveBeenCalled()
    }
  )

  test('[P0][4.4-FE-004][AC2,AC4] updates favorite through a safe body whitelist', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          assetState: {
            outputId: 'output-1',
            rating: null,
            feedbackTextPresent: false,
            isFavorited: true,
            updatedAt: '2026-05-21T06:10:00.000Z',
          },
        },
      }),
    })

    await expect(
      updateThinkTankOutputFavorite('session-1', {
        outputId: ' output-1 ',
        isFavorited: true,
        tenantId: 'attacker-tenant',
        title: 'raw title',
      } as never)
    ).resolves.toEqual({
      sessionId: 'session-1',
      assetState: {
        outputId: 'output-1',
        rating: null,
        feedbackTextPresent: false,
        isFavorited: true,
        updatedAt: '2026-05-21T06:10:00.000Z',
      },
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/sessions/session-1/output/favorite', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outputId: 'output-1',
        isFavorited: true,
      }),
      cache: 'no-store',
    })
  })

  test('[P0][4.4-FE-004A][AC2] rejects invalid favorite state before fetch', async () => {
    await expect(
      updateThinkTankOutputFavorite('session-1', {
        outputId: 'output-1',
        isFavorited: undefined,
      } as never),
    ).rejects.toThrow(THINKTANK_OUTPUT_FAVORITE_REQUIRED_MESSAGE)

    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('[P1][4.4-FE-004B][AC2,AC4] fetches current output asset state through the BFF route', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          assetState: {
            outputId: 'output-1',
            rating: 4,
            feedbackTextPresent: true,
            isFavorited: true,
            updatedAt: '2026-05-21T06:10:00.000Z',
          },
        },
      }),
    })

    await expect(
      fetchThinkTankOutputAssetState('session-1', { outputId: ' output-1 ' }),
    ).resolves.toEqual({
      sessionId: 'session-1',
      assetState: {
        outputId: 'output-1',
        rating: 4,
        feedbackTextPresent: true,
        isFavorited: true,
        updatedAt: '2026-05-21T06:10:00.000Z',
      },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/advisory/sessions/session-1/output/state?outputId=output-1',
      {
        headers: { Authorization: 'Bearer session-token' },
        cache: 'no-store',
      },
    )
  })
})
