import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'

export const THINKTANK_RESEARCH_WEB_SEARCH_UNAVAILABLE_MESSAGE =
  'BMAD Research 工作流需要真实 Web search 服务，当前未配置或未返回可验证来源。'

export type ThinkTankResearchWorkflowKey = 'domain-research' | 'market-research'

export interface ThinkTankResearchWebSearchQueryResult {
  query: string
  requestId?: string
  results: ThinkTankResearchWebSearchResultItem[]
}

export interface ThinkTankResearchWebSearchResultItem {
  ref: string
  query: string
  title: string
  url: string
  snippet: string
  source?: string
  publishedAt?: string
}

export interface ThinkTankResearchWebSearchResult {
  provider: 'bigmodel-web-search'
  searchedAt: string
  searchEngine: string
  queries: ThinkTankResearchWebSearchQueryResult[]
  results: ThinkTankResearchWebSearchResultItem[]
  errors: string[]
}

interface ThinkTankResearchWebSearchContext {
  workflowKey: ThinkTankResearchWorkflowKey
  tenantId: string
  actorId: string
  sessionId: string
  topic: string
  signal?: AbortSignal
}

interface BigModelWebSearchPayload {
  id?: string
  request_id?: string
  search_result?: Array<{
    title?: string
    content?: string
    link?: string
    media?: string
    refer?: string
    publish_date?: string
  }>
}

interface ResolvedResearchWebSearchConfig {
  enabled: boolean
  apiKey?: string
  endpoint: string
  searchEngine: string
  count: number
  maxQueries: number
  maxResults: number
  recencyFilter: string
  contentSize: string
}

const RESEARCH_WORKFLOW_KEYS = new Set<string>(['domain-research', 'market-research'])
const BIGMODEL_WEB_SEARCH_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/web_search'
const DEFAULT_SEARCH_ENGINE = 'search_std'
const DEFAULT_RESULT_COUNT = 5
const DEFAULT_MAX_QUERIES = 4
const DEFAULT_MAX_RESULTS = 20
const MAX_BIGMODEL_QUERY_LENGTH = 70

@Injectable()
export class ThinkTankResearchWebSearchService {
  constructor(private readonly configService: ConfigService) {}

  isAvailable(): boolean {
    return this.resolveConfig().enabled
  }

  async search(
    context: ThinkTankResearchWebSearchContext,
  ): Promise<ThinkTankResearchWebSearchResult> {
    const config = this.resolveConfig()
    if (!config.enabled || !config.apiKey) {
      throw new Error('ThinkTank research web search is not configured')
    }

    const queries = this.buildQueries(context.workflowKey, context.topic).slice(
      0,
      config.maxQueries,
    )
    const settled = await Promise.allSettled(
      queries.map((query) => this.searchQuery(config, context, query)),
    )
    const queryResults: ThinkTankResearchWebSearchQueryResult[] = []
    const errors: string[] = []

    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        queryResults.push(result.value)
      } else {
        errors.push(`${queries[index]}: ${this.errorMessage(result.reason)}`)
      }
    })

    const results = this.deduplicateResults(
      queryResults.flatMap((queryResult) => queryResult.results),
      config.maxResults,
    )
    if (results.length === 0) {
      throw new Error('ThinkTank research web search returned no verified results')
    }

    return {
      provider: 'bigmodel-web-search',
      searchedAt: new Date().toISOString(),
      searchEngine: config.searchEngine,
      queries: queryResults,
      results,
      errors,
    }
  }

  private async searchQuery(
    config: ResolvedResearchWebSearchConfig,
    context: ThinkTankResearchWebSearchContext,
    query: string,
  ): Promise<ThinkTankResearchWebSearchQueryResult> {
    const requestId = this.createRequestId(context.sessionId)
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        search_query: query,
        search_engine: config.searchEngine,
        search_intent: false,
        count: config.count,
        search_recency_filter: config.recencyFilter,
        content_size: config.contentSize,
        request_id: requestId,
        user_id: context.actorId,
      }),
      signal: context.signal,
    })

    if (!response.ok) {
      throw new Error(`BigModel web search failed with HTTP ${response.status}`)
    }

    const payload = (await response.json()) as BigModelWebSearchPayload
    const results = (payload.search_result ?? [])
      .map((item) => this.toResultItem(query, item))
      .filter((item): item is ThinkTankResearchWebSearchResultItem => Boolean(item))

    return {
      query,
      requestId: payload.request_id ?? payload.id ?? requestId,
      results,
    }
  }

  private toResultItem(
    query: string,
    item: NonNullable<BigModelWebSearchPayload['search_result']>[number],
  ): ThinkTankResearchWebSearchResultItem | null {
    const url = this.normalizeUrl(item.link)
    if (!url) return null

    return {
      ref: item.refer?.trim() || '',
      query,
      title: this.cleanText(item.title) || url,
      url,
      snippet: this.cleanText(item.content),
      ...(this.cleanText(item.media) ? { source: this.cleanText(item.media) } : {}),
      ...(this.cleanText(item.publish_date)
        ? { publishedAt: this.cleanText(item.publish_date) }
        : {}),
    }
  }

  private buildQueries(workflowKey: ThinkTankResearchWorkflowKey, topic: string): string[] {
    const normalizedTopic = this.truncateQuery(this.cleanText(topic) || 'research topic', 42)
    const suffixes =
      workflowKey === 'domain-research'
        ? ['行业趋势 2026', '市场规模 2026', '监管 政策 2026', '主要参与者 格局']
        : ['market size 2026', 'customer trends 2026', 'competitors 2026', 'market forecast 2026']

    return this.uniqueQueries(
      [normalizedTopic, ...suffixes.map((suffix) => `${normalizedTopic} ${suffix}`)].map((query) =>
        this.truncateQuery(query, MAX_BIGMODEL_QUERY_LENGTH),
      ),
    )
  }

  private deduplicateResults(
    results: ThinkTankResearchWebSearchResultItem[],
    maxResults: number,
  ): ThinkTankResearchWebSearchResultItem[] {
    const byUrl = new Map<string, ThinkTankResearchWebSearchResultItem>()

    for (const result of results) {
      const key = result.url.replace(/#.*$/, '')
      if (!byUrl.has(key)) {
        byUrl.set(key, result)
      }
    }

    return [...byUrl.values()].slice(0, maxResults).map((result, index) => ({
      ...result,
      ref: `W${index + 1}`,
    }))
  }

  private resolveConfig(): ResolvedResearchWebSearchConfig {
    const apiKey = this.resolveApiKey()
    const enabledFlag = this.readString('THINKTANK_RESEARCH_WEB_SEARCH_ENABLED')
    const explicitlyDisabled = enabledFlag?.toLowerCase() === 'false'
    const explicitlyEnabled = enabledFlag?.toLowerCase() === 'true'
    const enabled = !explicitlyDisabled && Boolean(apiKey) && (explicitlyEnabled || Boolean(apiKey))

    return {
      enabled,
      apiKey: apiKey ?? undefined,
      endpoint:
        this.readString('THINKTANK_RESEARCH_WEB_SEARCH_BASE_URL') ?? BIGMODEL_WEB_SEARCH_ENDPOINT,
      searchEngine:
        this.readString('THINKTANK_RESEARCH_WEB_SEARCH_ENGINE') ?? DEFAULT_SEARCH_ENGINE,
      count: this.readBoundedInteger(
        'THINKTANK_RESEARCH_WEB_SEARCH_COUNT',
        DEFAULT_RESULT_COUNT,
        1,
        50,
      ),
      maxQueries: this.readBoundedInteger(
        'THINKTANK_RESEARCH_WEB_SEARCH_MAX_QUERIES',
        DEFAULT_MAX_QUERIES,
        1,
        8,
      ),
      maxResults: this.readBoundedInteger(
        'THINKTANK_RESEARCH_WEB_SEARCH_MAX_RESULTS',
        DEFAULT_MAX_RESULTS,
        1,
        50,
      ),
      recencyFilter: this.readString('THINKTANK_RESEARCH_WEB_SEARCH_RECENCY_FILTER') ?? 'oneYear',
      contentSize: this.readString('THINKTANK_RESEARCH_WEB_SEARCH_CONTENT_SIZE') ?? 'medium',
    }
  }

  private resolveApiKey(): string | null {
    const explicit = this.readString('THINKTANK_RESEARCH_WEB_SEARCH_API_KEY')
    if (explicit) return explicit

    const glmApiKey = this.readString('GLM_API_KEY')
    if (glmApiKey) return glmApiKey

    const openAiBaseUrl = this.readString('OPENAI_BASE_URL')
    if (openAiBaseUrl?.toLowerCase().includes('open.bigmodel.cn')) {
      return this.readString('OPENAI_API_KEY')
    }

    return null
  }

  private createRequestId(sessionId: string): string {
    return `${sessionId.slice(0, 8)}-${randomUUID()}`.slice(0, 64)
  }

  private uniqueQueries(queries: string[]): string[] {
    return [...new Set(queries.map((query) => query.trim()).filter(Boolean))]
  }

  private truncateQuery(query: string, maxLength: number): string {
    return Array.from(query).slice(0, maxLength).join('').trim()
  }

  private normalizeUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!/^https?:\/\//i.test(trimmed)) return null
    return trimmed
  }

  private cleanText(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  }

  private readString(key: string): string | null {
    const value = this.configService.get<string | undefined>(key)
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private readBoundedInteger(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ): number {
    const rawValue = this.readString(key)
    if (!rawValue) return fallback

    const value = Number(rawValue)
    return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}

export function isThinkTankResearchWorkflowKey(
  workflowKey: string,
): workflowKey is ThinkTankResearchWorkflowKey {
  return RESEARCH_WORKFLOW_KEYS.has(workflowKey)
}
