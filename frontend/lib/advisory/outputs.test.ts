import {
  THINKTANK_OUTPUT_APPEND_FAILED_MESSAGE,
  THINKTANK_OUTPUT_COMPLETE_FAILED_MESSAGE,
  THINKTANK_OUTPUT_LOAD_FAILED_MESSAGE,
  appendThinkTankOutputSection,
  completeThinkTankSessionOutput,
  fetchThinkTankSessionOutput,
} from './outputs'
import { getAuthHeadersAsync } from '@/lib/utils/jwt'

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
    status: 'draft',
    title: 'Problem Solving Report Draft',
    summary: 'Live report draft for the problem-solving workflow.',
    contentMarkdown:
      '# Problem Solving Report Draft\n\n## Diagnose retention\n\n[AI Generated]\n\nRetention drops after the second session.',
    sections: [
      {
        id: 'section-1',
        stepIndex: 1,
        heading: 'Diagnose retention',
        contentMarkdown: '[AI Generated]\n\nRetention drops after the second session.',
        aiLabel: '[AI Generated]',
        metadata: {
          ai_generated: true,
          workflow_key: 'problem-solving',
        },
      },
    ],
    aiLabelMetadata: {
      visible_label: '[AI Generated]',
      ai_generated: true,
      machine_readable: true,
    },
    metadata: {
      section_count: 1,
      last_step_index: 1,
    },
    ...overrides,
  }
}

describe('ThinkTank workflow output client (ATDD RED)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  test('[P0] loads the current tenant-scoped output draft and preserves AI label fields', async () => {
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
        sections: [
          expect.objectContaining({
            aiLabel: '[AI Generated]',
            contentMarkdown: expect.stringContaining('[AI Generated]'),
          }),
        ],
        aiLabelMetadata: expect.objectContaining({
          visible_label: '[AI Generated]',
          machine_readable: true,
        }),
      }),
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/sessions/session-1/output', {
      headers: { Authorization: 'Bearer session-token' },
      cache: 'no-store',
    })
  })

  test('[P0] appends a section through the output proxy without relaying tenant or unsafe provider fields', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          output: createOutputEnvelope(),
          section: createOutputEnvelope().sections[0],
        },
      }),
    })

    await expect(
      appendThinkTankOutputSection('session-1', {
        tenantId: 'attacker-tenant',
        outputId: 'attacker-output',
        stepIndex: 1,
        stepLabel: 'Diagnose retention',
        contentMarkdown: 'Retention drops after the second session.',
        sourceMessageId: 'assistant-message-1',
        providerMetadata: {
          provider: 'fake',
          model: 'fake-thinktank-model',
          latencyMs: 12,
          rawPrompt: 'do not forward',
        },
      } as never)
    ).resolves.toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        output: expect.objectContaining({
          aiLabelMetadata: expect.objectContaining({ visible_label: '[AI Generated]' }),
        }),
      })
    )

    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/sessions/session-1/output/sections', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stepIndex: 1,
        stepLabel: 'Diagnose retention',
        contentMarkdown: 'Retention drops after the second session.',
        sourceMessageId: 'assistant-message-1',
        providerMetadata: {
          provider: 'fake',
          model: 'fake-thinktank-model',
          latencyMs: 12,
        },
      }),
      cache: 'no-store',
    })
    expect(mockFetch.mock.calls[0][1].body).not.toContain('attacker-tenant')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('rawPrompt')
  })

  test('[2.10-FE-RED-001][P1] preserves safe prompt-cache provider metadata and strips raw prompt fields when appending sections', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          output: createOutputEnvelope(),
          section: createOutputEnvelope().sections[0],
        },
      }),
    })

    await appendThinkTankOutputSection('session-1', {
      stepIndex: 1,
      stepLabel: 'Diagnose retention',
      contentMarkdown: 'Retention drops after the second session.',
      sourceMessageId: 'assistant-message-1',
      providerMetadata: {
        provider: 'fake',
        model: 'fake-thinktank-smoke',
        latencyMs: 14,
        inputTokens: 120,
        outputTokens: 20,
        totalTokens: 140,
        estimatedCost: 0.003,
        cacheStatus: 'hit',
        cacheStrategy: 'provider-auto',
        cacheKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        cacheReadInputTokens: 96,
        cacheCreationInputTokens: 0,
        cachedInputTokens: 96,
        cacheEligibleInputTokens: 120,
        rawPrompt: 'do not forward',
        messages: [{ role: 'user', content: 'do not forward' }],
        content: 'do not forward',
      },
    } as never)

    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/sessions/session-1/output/sections', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stepIndex: 1,
        stepLabel: 'Diagnose retention',
        contentMarkdown: 'Retention drops after the second session.',
        sourceMessageId: 'assistant-message-1',
        providerMetadata: {
          provider: 'fake',
          model: 'fake-thinktank-smoke',
          latencyMs: 14,
          inputTokens: 120,
          outputTokens: 20,
          totalTokens: 140,
          estimatedCost: 0.003,
          cacheStatus: 'hit',
          cacheStrategy: 'provider-auto',
          cacheKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          cacheReadInputTokens: 96,
          cacheCreationInputTokens: 0,
          cachedInputTokens: 96,
          cacheEligibleInputTokens: 120,
        },
      }),
      cache: 'no-store',
    })
    expect(mockFetch.mock.calls[0][1].body).not.toContain('rawPrompt')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('messages')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('do not forward')
  })

  test('[P0] completes a workflow output using only the final outcome contract', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          output: createOutputEnvelope({ status: 'completed' }),
        },
      }),
    })

    await expect(
      completeThinkTankSessionOutput('session-1', {
        outcome: 'success',
        tenantId: 'attacker-tenant',
        contentMarkdown: 'raw report text must not be posted to complete',
        sections: [{ contentMarkdown: 'raw section text must not be posted to complete' }],
      } as never)
    ).resolves.toEqual({
      sessionId: 'session-1',
      output: expect.objectContaining({ status: 'completed' }),
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/sessions/session-1/output/complete', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ outcome: 'success' }),
      cache: 'no-store',
    })
    expect(mockFetch.mock.calls[0][1].body).not.toContain('raw report text')
  })

  test('[P0] reads backend error envelopes from output APIs without masking the provider code path', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          code: 'THINKTANK_OUTPUT_NOT_FOUND',
          message: 'ThinkTank output draft not found.',
        },
      }),
    })

    await expect(fetchThinkTankSessionOutput('session-1')).rejects.toThrow(
      'ThinkTank output draft not found.'
    )
  })

  test('[P1] rejects malformed successful output envelopes that omit AI labeling metadata', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          output: createOutputEnvelope({ aiLabelMetadata: undefined }),
        },
      }),
    })

    await expect(fetchThinkTankSessionOutput('session-1')).rejects.toThrow(
      THINKTANK_OUTPUT_LOAD_FAILED_MESSAGE
    )
  })
})
