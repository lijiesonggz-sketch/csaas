import { fetchAdvisoryOperationsUsage, normalizeAdvisoryOperationsUsage } from './operations'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
}))

const backendPayload = {
  generatedAt: '2026-05-22T08:12:12.000Z',
  appliedFilters: {
    tenantId: 'tenant-alpha',
    dateFrom: '2026-05-01T00:00:00.000Z',
    dateTo: '2026-05-22T23:59:59.999Z',
  },
  summary: {
    quickConsult: { started: 32, completed: 30, failed: 2, volume: 32 },
    workflows: { started: 12, completed: 7, startFailed: 1, incomplete: 5, completionRate: 0.5833 },
    partyMode: { budgetExceeded: 2, advisorFailed: 1 },
    measurementStatus: 'fresh',
  },
  usageByWorkflowType: [
    {
      workflowKey: 'problem-solving',
      workflowLabel: 'Problem Solving',
      trendPeriod: {
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-22T23:59:59.999Z',
      },
      starts: 10,
      completions: 3,
      startFailures: 1,
      incompleteSessions: 7,
      completionRate: 0.3,
      lowCompletion: true,
      drilldown: {
        starts: 10,
        completions: 3,
        startFailures: 1,
        incompleteSessions: 7,
      },
      prompt: 'PRIVATE_PROMPT_DO_NOT_RENDER',
    },
  ],
  instrumentationGaps: [
    {
      eventName: 'thinktank.workflow.mystery',
      reason: 'unknown_event_name',
      owner: 'workflow telemetry',
      count: 2,
    },
  ],
  freshness: {
    source: 'audit_logs',
    status: 'fresh',
    latestEventAt: '2026-05-22T08:10:00.000Z',
    description: 'Telemetry is current.',
  },
  rawConversationContent: 'PRIVATE_CONVERSATION_DO_NOT_RENDER',
}

describe('advisory operations client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('normalizes backend aggregate usage into privacy-safe UI data', () => {
    const normalized = normalizeAdvisoryOperationsUsage(backendPayload)

    expect(normalized.metrics).toEqual({
      quickConsultVolume: 32,
      structuredWorkflowStarts: 12,
      completions: 7,
      incompleteSessions: 5,
      completionRate: 58.33,
      partyModeUsage: 3,
    })
    expect(normalized.workflowUsage[0]).toEqual(
      expect.objectContaining({
        workflowKey: 'problem-solving',
        workflowLabel: 'Problem Solving',
        trendPeriod: '2026-05-01 to 2026-05-22',
        starts: 10,
        completions: 3,
        incompleteSessions: 7,
        completionRate: 30,
        lowCompletion: true,
      })
    )
    expect(JSON.stringify(normalized)).not.toMatch(/PRIVATE_|rawConversation|prompt/i)
  })

  it('does not send the current-tenant sentinel as a backend tenant id', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: backendPayload }),
    })

    await fetchAdvisoryOperationsUsage({
      tenantId: 'current',
      dateFrom: '2026-05-01',
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/advisory/admin/operations/usage?dateFrom=2026-05-01',
      expect.any(Object)
    )
  })

  it('fetches usage with only supported query parameters and unwraps data envelopes', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: backendPayload }),
    })

    await expect(
      fetchAdvisoryOperationsUsage({
        tenantId: 'tenant-alpha',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-22',
        workflowType: 'problem-solving',
      })
    ).resolves.toEqual(expect.objectContaining({ metrics: expect.any(Object) }))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/advisory/admin/operations/usage?tenantId=tenant-alpha&dateFrom=2026-05-01&dateTo=2026-05-22&workflowType=problem-solving',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
        cache: 'no-store',
      })
    )
  })

  it('uses unavailable dashboard bodies from non-2xx responses when present', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        data: {
          ...backendPayload,
          summary: { ...backendPayload.summary, measurementStatus: 'unavailable' },
          freshness: {
            source: 'audit_logs',
            status: 'unavailable',
            latestEventAt: null,
            description: 'No trusted measurements are available.',
          },
        },
      }),
    })

    await expect(fetchAdvisoryOperationsUsage()).resolves.toEqual(
      expect.objectContaining({
        freshness: expect.objectContaining({ status: 'unavailable' }),
        metrics: null,
      })
    )
  })
})

const providerTelemetryPayload = {
  generatedAt: '2026-05-23T01:30:00.000Z',
  appliedFilters: {
    tenantId: 'tenant-alpha',
    dateFrom: '2026-05-01T00:00:00.000Z',
    dateTo: '2026-05-22T23:59:59.999Z',
    groupBy: ['workflow', 'experience', 'provider'],
  },
  summary: {
    terminalCalls: 8,
    successfulCalls: 6,
    failedCalls: 2,
    retryEvents: 1,
    errorRate: 0.25,
    timeoutRate: 0.125,
    estimatedTokens: 12000,
    estimatedCost: 18.75,
    latency: { averageMs: 3400, p95Ms: 6200 },
    tokens: { input: 7200, output: 4800, total: 12000, estimated: 12000 },
    measurementStatus: 'fresh',
  },
  byWorkflow: [
    {
      workflowKey: 'problem-solving',
      workflowLabel: 'Problem Solving',
      terminalCalls: 5,
      successfulCalls: 3,
      failedCalls: 2,
      retryEvents: 1,
      errorRate: 0.4,
      timeoutRate: 0.2,
      estimatedTokens: 9000,
      estimatedCost: 13.5,
      latency: { averageMs: 3600, p95Ms: 6400 },
      tokens: { input: 5400, output: 3600, total: 9000, estimated: 9000 },
      measurementStatus: 'fresh',
      cacheHits: 3,
      cacheMisses: 2,
      cacheBypasses: 0,
    },
  ],
  byExperience: [
    {
      experience: 'quick_consult',
      terminalCalls: 3,
      successfulCalls: 3,
      failedCalls: 0,
      retryEvents: 0,
      errorRate: 0,
      timeoutRate: 0,
      estimatedTokens: 900,
      estimatedCost: 1.2,
      latency: { averageMs: 1400, p95Ms: 2300 },
      tokens: { input: 500, output: 400, total: 900, estimated: 900 },
      measurementStatus: 'fresh',
      cacheHits: 2,
      cacheMisses: 1,
      cacheBypasses: 0,
    },
    {
      experience: 'party_mode',
      terminalCalls: 5,
      successfulCalls: 3,
      failedCalls: 2,
      retryEvents: 1,
      errorRate: 0.4,
      timeoutRate: 0.2,
      estimatedTokens: 11100,
      estimatedCost: 17.55,
      latency: { averageMs: 4600, p95Ms: 7200 },
      tokens: { input: 6700, output: 4400, total: 11100, estimated: 11100 },
      measurementStatus: 'fresh',
      cacheHits: 2,
      cacheMisses: 3,
      cacheBypasses: 1,
    },
  ],
  byProvider: [
    {
      provider: 'zhipu-glm',
      terminalCalls: 8,
      successfulCalls: 6,
      failedCalls: 2,
      retryEvents: 1,
      errorRate: 0.25,
      timeoutRate: 0.125,
      estimatedTokens: 12000,
      estimatedCost: 18.75,
      latency: { averageMs: 3400, p95Ms: 6200 },
      tokens: { input: 7200, output: 4800, total: 12000, estimated: 12000 },
      measurementStatus: 'fresh',
      cacheHits: 5,
      cacheMisses: 3,
      cacheBypasses: 1,
    },
  ],
  cache: {
    hits: 5,
    misses: 3,
    bypasses: 1,
    totalLookups: 9,
    hitRate: 0.5556,
    cachedInputTokens: 3200,
    cacheReadInputTokens: 2200,
    cacheCreationInputTokens: 1000,
    cacheEligibleInputTokens: 5900,
  },
  instrumentationGaps: [
    {
      eventName: 'thinktank.provider.call_failed',
      reason: 'missing_grouping_metadata',
      owner: 'provider_gateway',
      count: 1,
    },
  ],
  freshness: {
    source: 'audit_logs',
    status: 'fresh',
    latestEventAt: '2026-05-22T08:10:00.000Z',
    description: 'Provider telemetry is current.',
  },
  rawProviderPayload: 'PRIVATE_PROMPT_DO_NOT_RENDER',
}

describe('advisory provider telemetry client ATDD (Story 6.3 RED)', () => {
  it('[6.3-UNIT-001][P1][AC1,AC2] normalizes provider aggregates, grouped metrics, and threshold breaches', async () => {
    const operationsModule = (await import('./operations')) as Record<string, unknown>
    const normalizeAdvisoryProviderTelemetry =
      operationsModule.normalizeAdvisoryProviderTelemetry as (data: unknown) => {
        metrics: Record<string, unknown> | null
        byWorkflow: Array<Record<string, unknown>>
        byExperience: Array<Record<string, unknown>>
        byProvider: Array<Record<string, unknown>>
        thresholdBreaches: Array<Record<string, unknown>>
      }

    const normalized = normalizeAdvisoryProviderTelemetry(providerTelemetryPayload)

    expect(normalized.metrics).toEqual(
      expect.objectContaining({
        terminalCalls: 8,
        failedCalls: 2,
        retryEvents: 1,
        errorRate: 25,
        timeoutRate: 12.5,
        estimatedTokens: 12000,
        estimatedCost: 18.75,
        averageLatencyMs: 3400,
        p95LatencyMs: 6200,
        cacheHitRate: 55.56,
      })
    )
    expect(normalized.byWorkflow[0]).toEqual(
      expect.objectContaining({
        key: 'problem-solving',
        label: 'Problem Solving',
        errorRate: 40,
        p95LatencyMs: 6400,
      })
    )
    expect(normalized.byExperience).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'quick_consult', label: 'Quick Consult' }),
        expect.objectContaining({ key: 'party_mode', label: 'Party Mode' }),
      ])
    )
    expect(normalized.thresholdBreaches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'P95 latency',
          actualValue: '6200 ms',
          thresholdValue: '5000 ms',
          tenantId: 'tenant-alpha',
          timeWindow: '2026-05-01 to 2026-05-22',
        }),
      ])
    )
    expect(JSON.stringify(normalized)).not.toMatch(
      /PRIVATE_|rawProvider|prompt|conversation|report|feedback/i
    )
  })

  it('[6.3-UNIT-002][P1][AC1] fetches provider telemetry through the Next proxy with safe filters only', async () => {
    const operationsModule = (await import('./operations')) as Record<string, unknown>
    const fetchAdvisoryProviderTelemetry = operationsModule.fetchAdvisoryProviderTelemetry as (
      filters: Record<string, unknown>
    ) => Promise<unknown>
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: providerTelemetryPayload }),
    })

    await fetchAdvisoryProviderTelemetry({
      tenantId: 'current',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-22',
      workflowType: 'problem-solving',
      groupBy: ['workflow', 'experience', 'provider'],
      actorId: 'malicious-actor',
      rawPrompt: 'PRIVATE_PROMPT_DO_NOT_FORWARD',
      providerRawPayload: 'PRIVATE_PROVIDER_PAYLOAD_DO_NOT_FORWARD',
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/advisory/admin/operations/provider-telemetry?dateFrom=2026-05-01&dateTo=2026-05-22&workflowType=problem-solving&groupBy=workflow%2Cexperience%2Cprovider',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
        cache: 'no-store',
      })
    )
  })

  it('[6.3-UNIT-003][P1][AC3] propagates provider telemetry auth failures and unavailable bodies', async () => {
    const operationsModule = (await import('./operations')) as Record<string, unknown>
    const fetchAdvisoryProviderTelemetry = operationsModule.fetchAdvisoryProviderTelemetry as (
      filters?: Record<string, unknown>
    ) => Promise<{
      metrics: Record<string, unknown> | null
      freshness: { status: string; description: string }
    }>

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'No access token' }),
    })

    await expect(fetchAdvisoryProviderTelemetry()).rejects.toThrow('No access token')
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: '当前账号无权查看其他租户的 ThinkTank provider telemetry。' }),
    })

    await expect(fetchAdvisoryProviderTelemetry({ tenantId: 'tenant-forbidden' })).rejects.toThrow(
      '当前账号无权查看其他租户的 ThinkTank provider telemetry。'
    )
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        data: {
          ...providerTelemetryPayload,
          summary: {
            ...providerTelemetryPayload.summary,
            terminalCalls: 0,
            failedCalls: 0,
            estimatedTokens: 0,
            estimatedCost: 0,
            measurementStatus: 'unavailable',
          },
          byWorkflow: [],
          byExperience: [],
          byProvider: [],
          cache: {
            ...providerTelemetryPayload.cache,
            hits: 0,
            misses: 0,
            totalLookups: 0,
            hitRate: null,
          },
          freshness: {
            source: 'audit_logs',
            status: 'unavailable',
            latestEventAt: null,
            description:
              'Provider telemetry source is unavailable. No trusted measurements are available.',
          },
        },
      }),
    })

    await expect(fetchAdvisoryProviderTelemetry()).resolves.toEqual(
      expect.objectContaining({
        metrics: null,
        freshness: expect.objectContaining({
          status: 'unavailable',
          description: expect.stringMatching(/No trusted measurements/i),
        }),
      })
    )
  })

  it('[6.3-UNIT-004][P1][AC3] treats unavailable provider telemetry as untrusted instead of successful zero metrics', async () => {
    const operationsModule = (await import('./operations')) as Record<string, unknown>
    const normalizeAdvisoryProviderTelemetry =
      operationsModule.normalizeAdvisoryProviderTelemetry as (data: unknown) => {
        metrics: Record<string, unknown> | null
        thresholdBreaches: Array<Record<string, unknown>>
        freshness: { status: string; description: string }
      }

    const normalized = normalizeAdvisoryProviderTelemetry({
      ...providerTelemetryPayload,
      summary: {
        ...providerTelemetryPayload.summary,
        terminalCalls: 0,
        failedCalls: 0,
        estimatedTokens: 0,
        estimatedCost: 0,
        measurementStatus: 'unavailable',
      },
      byWorkflow: [],
      byExperience: [],
      byProvider: [],
      cache: {
        ...providerTelemetryPayload.cache,
        hits: 0,
        misses: 0,
        totalLookups: 0,
        hitRate: null,
      },
      freshness: {
        source: 'audit_logs',
        status: 'unavailable',
        latestEventAt: null,
        description:
          'Provider telemetry source is unavailable. No trusted measurements are available.',
      },
    })

    expect(normalized.metrics).toBeNull()
    expect(normalized.thresholdBreaches).toEqual([])
    expect(normalized.freshness).toEqual(
      expect.objectContaining({
        status: 'unavailable',
        description: expect.stringMatching(/No trusted measurements/i),
      })
    )
  })

  it('[6.3-UNIT-005][P1][AC2,AC3] sanitizes provider group and gap identifiers and suppresses delayed zero metrics', async () => {
    const operationsModule = (await import('./operations')) as Record<string, unknown>
    const normalizeAdvisoryProviderTelemetry =
      operationsModule.normalizeAdvisoryProviderTelemetry as (data: unknown) => {
        metrics: Record<string, unknown> | null
        byWorkflow: Array<Record<string, unknown>>
        byExperience: Array<Record<string, unknown>>
        byProvider: Array<Record<string, unknown>>
        instrumentationGaps: Array<Record<string, unknown>>
      }

    const normalized = normalizeAdvisoryProviderTelemetry({
      ...providerTelemetryPayload,
      summary: {
        terminalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        retryEvents: 0,
        errorRate: null,
        timeoutRate: null,
        estimatedTokens: 0,
        estimatedCost: 0,
        latency: { averageMs: null, p95Ms: null },
        tokens: { input: 0, output: 0, total: 0, estimated: 0 },
      },
      byWorkflow: [
        {
          workflowKey: 'PRIVATE_PROMPT_DO_NOT_RENDER',
          workflowLabel: 'PRIVATE_CONVERSATION_DO_NOT_RENDER',
          terminalCalls: 0,
          latency: { averageMs: null, p95Ms: null },
          tokens: { input: 0, output: 0, total: 0, estimated: 0 },
        },
      ],
      byExperience: [{ experience: 'PRIVATE_REPORT_DO_NOT_RENDER' }],
      byProvider: [{ provider: 'PRIVATE_PROVIDER_PAYLOAD_DO_NOT_RENDER' }],
      instrumentationGaps: [
        {
          eventName: 'PRIVATE_PROMPT_DO_NOT_RENDER',
          reason: 'PRIVATE_CACHE_KEY_DO_NOT_RENDER',
          owner: 'provider_gateway',
          count: 1,
        },
      ],
      freshness: {
        source: 'audit_logs',
        status: 'delayed',
        latestEventAt: '2026-05-20T08:10:00.000Z',
        description: 'Provider telemetry is delayed.',
      },
    })

    expect(normalized.metrics).toBeNull()
    expect(normalized.byWorkflow[0]).toEqual(
      expect.objectContaining({ key: 'unknown-workflow', label: 'Unknown Workflow' })
    )
    expect(normalized.byExperience[0]).toEqual(
      expect.objectContaining({ key: 'unknown-experience', label: 'Unknown Experience' })
    )
    expect(normalized.byProvider[0]).toEqual(
      expect.objectContaining({ key: 'unknown-provider', label: 'Unknown provider' })
    )
    expect(normalized.instrumentationGaps[0]).toEqual(
      expect.objectContaining({
        eventName: null,
        reason: 'unknown_gap',
        owningArea: 'provider_gateway',
      })
    )
    expect(JSON.stringify(normalized)).not.toMatch(
      /PRIVATE_|prompt|conversation|report|feedback|cache key/i
    )
  })
})
