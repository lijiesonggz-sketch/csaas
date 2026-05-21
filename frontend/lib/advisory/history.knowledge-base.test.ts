jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
}))

const mockFetch = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as never
})

describe('ThinkTank history knowledge-base association normalization', () => {
  test('[P1][4.5-FE-004][AC3] preserves association status on report history items', async () => {
    const { fetchThinkTankSessionHistory } = await import('./history')
    mockFetch.mockResolvedValueOnce({
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
              timestamp: '2026-05-21T08:05:00.000Z',
              openTarget: 'view-output',
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
          ],
          meta: { page: 1, limit: 20, total: 1 },
        },
      }),
    })

    await expect(fetchThinkTankSessionHistory({ type: 'output' })).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 'output-1',
          knowledgeBaseAssociation: expect.objectContaining({
            outputId: 'output-1',
            status: 'associated',
            externalReferenceId: 'kb-ref-1',
          }),
        }),
      ],
      meta: { page: 1, limit: 20, total: 1 },
    })
  })
})
