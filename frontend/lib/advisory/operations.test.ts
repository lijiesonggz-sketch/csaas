import {
  fetchAdvisoryOperationsUsage,
  normalizeAdvisoryOperationsUsage,
} from './operations'

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
      }),
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
      expect.any(Object),
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
      }),
    ).resolves.toEqual(expect.objectContaining({ metrics: expect.any(Object) }))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/advisory/admin/operations/usage?tenantId=tenant-alpha&dateFrom=2026-05-01&dateTo=2026-05-22&workflowType=problem-solving',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
        cache: 'no-store',
      }),
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
      }),
    )
  })
})
