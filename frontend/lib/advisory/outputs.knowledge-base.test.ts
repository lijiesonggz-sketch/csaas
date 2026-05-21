import {
  THINKTANK_OUTPUT_ID_REQUIRED_MESSAGE,
  type ThinkTankOutputKnowledgeBaseAssociationInput,
} from './outputs'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
}))

const mockFetch = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as never
})

describe('ThinkTank output knowledge-base association client', () => {
  test('[P0][4.5-FE-001][AC1,AC2] associates an output through a safe body whitelist and normalizes retryable state', async () => {
    const outputs = await import('./outputs')
    const unsafeInput = {
      outputId: ' output-1 ',
      destinationKey: ' enterprise-knowledge-base ',
      tenantId: 'evil-tenant',
      userId: 'evil-user',
      title: 'Spoofed title',
      contentMarkdown: '# raw',
      sections: [{ contentMarkdown: 'raw section' }],
    } as ThinkTankOutputKnowledgeBaseAssociationInput & Record<string, unknown>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          knowledgeBaseAssociation: {
            outputId: 'output-1',
            status: 'pending',
            destinationKey: 'enterprise-knowledge-base',
            externalReferenceId: null,
            message: '知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。',
            retryCount: 1,
            updatedAt: '2026-05-21T08:00:00.000Z',
            associatedAt: null,
          },
        },
      }),
    })

    await expect(
      outputs.associateThinkTankOutputWithKnowledgeBase('session-1', unsafeInput)
    ).resolves.toEqual({
      sessionId: 'session-1',
      knowledgeBaseAssociation: {
        outputId: 'output-1',
        status: 'pending',
        destinationKey: 'enterprise-knowledge-base',
        externalReferenceId: null,
        message: '知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。',
        retryCount: 1,
        updatedAt: '2026-05-21T08:00:00.000Z',
        associatedAt: null,
      },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/advisory/sessions/session-1/output/knowledge-base',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outputId: 'output-1',
        }),
        cache: 'no-store',
      }
    )
  })

  test('[P0][4.5-FE-004][AC3] fetches association state through the implemented knowledge-base proxy route', async () => {
    const outputs = await import('./outputs')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          knowledgeBaseAssociation: {
            outputId: 'output-1',
            status: 'associated',
            destinationKey: 'enterprise-knowledge-base',
            externalReferenceId: 'kb-ref-1',
            message: null,
            retryCount: 1,
            updatedAt: '2026-05-21T08:05:00.000Z',
            associatedAt: '2026-05-21T08:05:00.000Z',
          },
        },
      }),
    })

    await expect(
      outputs.fetchThinkTankOutputKnowledgeBaseAssociationState('session-1', {
        outputId: 'output-1',
      })
    ).resolves.toEqual({
      sessionId: 'session-1',
      knowledgeBaseAssociation: expect.objectContaining({
        outputId: 'output-1',
        status: 'associated',
      }),
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/advisory/sessions/session-1/output/knowledge-base?outputId=output-1',
      expect.objectContaining({ cache: 'no-store' })
    )
  })

  test('[P0][4.5-FE-002][AC1] rejects missing outputId before fetch', async () => {
    const outputs = await import('./outputs')

    await expect(
      outputs.associateThinkTankOutputWithKnowledgeBase('session-1', { outputId: ' ' })
    ).rejects.toThrow(THINKTANK_OUTPUT_ID_REQUIRED_MESSAGE)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('[P1][4.5-FE-003][AC2] surfaces backend failure message with actionable retry copy', async () => {
    const outputs = await import('./outputs')
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: '知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。',
      }),
    })

    await expect(
      outputs.associateThinkTankOutputWithKnowledgeBase('session-1', { outputId: 'output-1' })
    ).rejects.toThrow('知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。')
  })
})
