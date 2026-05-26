import { ConfigService } from '@nestjs/config'
import { ThinkTankResearchWebSearchService } from './thinktank-research-web-search.service'

describe('ThinkTankResearchWebSearchService', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('[P0] is available when BigModel credentials are configured', () => {
    const service = new ThinkTankResearchWebSearchService(
      new ConfigService({
        GLM_API_KEY: 'glm-key',
      }),
    )

    expect(service.isAvailable()).toBe(true)
  })

  it('[P0] is unavailable when search is explicitly disabled', () => {
    const service = new ThinkTankResearchWebSearchService(
      new ConfigService({
        GLM_API_KEY: 'glm-key',
        THINKTANK_RESEARCH_WEB_SEARCH_ENABLED: 'false',
      }),
    )

    expect(service.isAvailable()).toBe(false)
  })

  it('[P0] calls BigModel Web Search API and normalizes verified citation results', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'search-id-1',
        request_id: 'search-request-1',
        search_result: [
          {
            title: 'Enterprise AI consulting market trends',
            content: 'AI consulting buyers now expect measurable productivity gains.',
            link: 'https://example.com/ai-consulting-market',
            media: 'Example Research',
            refer: 'ref_1',
            publish_date: '2026-05-20',
          },
        ],
      }),
    })
    global.fetch = fetchMock as never
    const service = new ThinkTankResearchWebSearchService(
      new ConfigService({
        GLM_API_KEY: 'glm-key',
        THINKTANK_RESEARCH_WEB_SEARCH_MAX_QUERIES: '1',
        THINKTANK_RESEARCH_WEB_SEARCH_COUNT: '3',
      }),
    )

    const result = await service.search({
      workflowKey: 'market-research',
      tenantId: 'tenant-1',
      actorId: 'actor-1',
      sessionId: 'session-1',
      topic: '企业 AI 咨询市场的最新趋势',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://open.bigmodel.cn/api/paas/v4/web_search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer glm-key',
          'Content-Type': 'application/json',
        }),
      }),
    )
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(requestBody).toEqual(
      expect.objectContaining({
        search_engine: 'search_std',
        search_intent: false,
        count: 3,
        search_recency_filter: 'oneYear',
        content_size: 'medium',
      }),
    )
    expect(requestBody.search_query.length).toBeLessThanOrEqual(70)
    expect(result).toEqual(
      expect.objectContaining({
        provider: 'bigmodel-web-search',
        searchEngine: 'search_std',
        queries: [
          expect.objectContaining({
            query: requestBody.search_query,
            requestId: 'search-request-1',
          }),
        ],
        results: [
          expect.objectContaining({
            ref: 'W1',
            title: 'Enterprise AI consulting market trends',
            url: 'https://example.com/ai-consulting-market',
            source: 'Example Research',
            publishedAt: '2026-05-20',
          }),
        ],
      }),
    )
  })
})
