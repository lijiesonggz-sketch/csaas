const rawSentinels = [
  'PRIVATE_CONVERSATION_DO_NOT_RENDER',
  'raw prompt',
  'report content',
  'provider payload',
  'cache key',
]

describe('Story 6.5 governance operations client ATDD (RED)', () => {
  beforeEach(() => {
    jest.resetModules()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          generatedAt: '2026-05-23T04:15:00.000Z',
          appliedFilters: {
            tenantId: 'tenant-alpha',
            dateFrom: '2026-05-01T00:00:00.000Z',
            dateTo: '2026-05-22T23:59:59.999Z',
            actorId: 'actor-42',
            eventType: 'thinktank.output.exported',
            outcome: 'success',
            groupBy: ['eventType', 'outcome', 'actor', 'workflow'],
          },
          summary: {
            measurementStatus: 'fresh',
            totalEvents: 18,
            trustedEvents: 15,
            malformedEvents: 3,
            deniedActions: 2,
            exportedOutputs: 3,
            exportsMissingAiLabelMetadata: 1,
            complianceIssueCount: 2,
            trustedEventRate: 0.8333,
            exportsMissingAiLabelRate: 0.3333,
          },
          byEventType: [
            {
              eventName: 'thinktank.output.exported',
              count: 3,
              successCount: 2,
              deniedCount: 0,
              owningArea: 'report export',
              owningStory: 'Story 2.9 report export',
            },
          ],
          byOutcome: [{ outcome: 'success', count: 12 }],
          byActor: [{ actorId: 'actor-42', count: 7, deniedCount: 1 }],
          byWorkflow: [
            { workflowKey: 'problem-solving', workflowLabel: 'Problem Solving', count: 9 },
          ],
          exportedOutputs: [
            {
              outputId: 'output-safe-002',
              eventName: 'thinktank.output.exported',
              aiLabelMetadataPresent: false,
              complianceStatus: 'compliance_issue',
            },
          ],
          complianceIssues: [
            {
              id: 'missing-ai-label-output-safe-002',
              issueType: 'missing_ai_label_metadata',
              eventName: 'thinktank.output.exported',
              owningArea: 'report export',
              owningStory: 'Story 2.9 report export',
              message: 'AI label metadata missing for exported output output-safe-002.',
            },
          ],
          instrumentationGaps: [
            {
              eventName: 'thinktank.workflow.completed',
              reason: 'missing_required_field',
              owningArea: 'workflow telemetry',
              owningStory: 'Story 3.4 workflow completion',
              count: 2,
            },
          ],
          freshness: {
            source: 'audit_logs',
            status: 'fresh',
            latestEventAt: '2026-05-22T08:10:00.000Z',
            description: 'Governance review is current.',
          },
          rawConversationContent: rawSentinels[0],
          prompt: rawSentinels[1],
          reportContent: rawSentinels[2],
          rawProviderPayload: rawSentinels[3],
          cacheKey: rawSentinels[4],
        },
      }),
    })
  })

  it('[6.5-FE-001][P1][AC1,AC2,AC3,AC4] fetches and normalizes governance review while suppressing raw sentinels', async () => {
    const operations = (await import('./operations')) as any

    const result = await operations.fetchAdvisoryGovernanceReview({
      tenantId: 'current',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-22',
      actorId: 'actor-42',
      eventType: 'thinktank.output.exported',
      outcome: 'success',
      groupBy: ['eventType', 'outcome', 'actor', 'workflow'],
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/advisory/admin/operations/governance?dateFrom=2026-05-01&dateTo=2026-05-22&actorId=actor-42&eventType=thinktank.output.exported&outcome=success&groupBy=eventType%2Coutcome%2Cactor%2Cworkflow',
      expect.objectContaining({ cache: 'no-store' })
    )
    expect(result.metrics).toEqual(
      expect.objectContaining({
        totalEvents: 18,
        trustedEvents: 15,
        malformedEvents: 3,
        exportsMissingAiLabelMetadata: 1,
      })
    )
    expect(result.byEventType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'thinktank.output.exported',
          owningArea: 'report export',
        }),
      ])
    )
    expect(result.exportedOutputs[0]).toEqual(
      expect.objectContaining({
        outputId: 'output-safe-002',
        aiLabelMetadataPresent: false,
        complianceStatus: 'compliance_issue',
      })
    )
    expect(result.complianceIssues[0]).toEqual(
      expect.objectContaining({
        issueType: 'missing_ai_label_metadata',
        owningStory: 'Story 2.9 report export',
      })
    )
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE_|raw prompt|report content|provider payload|cache key/i
    )
  })

  it('[6.5-FE-002][P1][AC3] normalizes unavailable governance review as null metrics and empty trusted groups', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ accessToken: 'test-token', user: { id: 'operator-1' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            summary: { measurementStatus: 'unavailable' },
            byEventType: [],
            byOutcome: [],
            byActor: [],
            byWorkflow: [],
            exportedOutputs: [],
            instrumentationGaps: [
              { source: 'audit_logs', reason: 'governance_source_unavailable' },
            ],
            freshness: {
              source: 'audit_logs',
              status: 'unavailable',
              latestEventAt: null,
              description: 'Governance review unavailable. No trusted measurements are available.',
            },
          },
        }),
      })
    const operations = (await import('./operations')) as any

    const result = await operations.fetchAdvisoryGovernanceReview()

    expect(result.metrics).toBeNull()
    expect(result.byEventType).toEqual([])
    expect(result.exportedOutputs).toEqual([])
    expect(result.freshness.status).toBe('unavailable')
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: 'governance_source_unavailable' })])
    )
  })

  it('[6.5-FE-003][P0][AC1,AC4] does not forward unsafe governance filter values', async () => {
    const operations = (await import('./operations')) as any

    await operations.fetchAdvisoryGovernanceReview({
      actorId: 'PRIVATE_CONVERSATION_DO_NOT_RENDER',
      eventType: 'thinktank.output.exported',
      outcome: 'report content',
      workflowType: 'problem-solving',
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/advisory/admin/operations/governance?workflowType=problem-solving&eventType=thinktank.output.exported',
      expect.objectContaining({ cache: 'no-store' })
    )
  })

  it('[6.5-FE-004][P0][AC1] rejects non-2xx governance-shaped responses instead of rendering them as trusted data', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ accessToken: 'test-token', user: { id: 'operator-1' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          data: {
            summary: { measurementStatus: 'fresh', totalEvents: 99 },
            freshness: { source: 'audit_logs', status: 'fresh' },
            byEventType: [{ eventName: 'thinktank.output.exported', count: 99 }],
          },
          message: 'Forbidden',
        }),
      })
    const operations = (await import('./operations')) as any

    await expect(operations.fetchAdvisoryGovernanceReview()).rejects.toThrow(/Forbidden/i)
  })

  it('[6.5-FE-005][P1][AC2] treats missing or unknown export compliance status as an issue', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ accessToken: 'test-token', user: { id: 'operator-1' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            summary: { measurementStatus: 'fresh', exportedOutputs: 1 },
            exportedOutputs: [
              {
                outputId: 'output-safe-unknown',
                eventName: 'thinktank.output.exported',
                aiLabelMetadataPresent: false,
              },
            ],
            freshness: { source: 'audit_logs', status: 'fresh' },
          },
        }),
      })
    const operations = (await import('./operations')) as any

    const result = await operations.fetchAdvisoryGovernanceReview()

    expect(result.exportedOutputs[0]).toEqual(
      expect.objectContaining({
        outputId: 'output-safe-unknown',
        aiLabelMetadataPresent: false,
        complianceStatus: 'compliance_issue',
      })
    )
  })
})
