import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AdvisoryOperationsPage from './page'
import { fetchAdvisoryOperationsUsage } from '@/lib/advisory/operations'

jest.mock('@/lib/advisory/operations', () => ({
  fetchAdvisoryOperationsUsage: jest.fn(),
  fetchAdvisoryProviderTelemetry: jest.fn(),
  fetchAdvisoryQualityFeedback: jest.fn(),
}))

const dashboard = {
  generatedAt: '2026-05-22T08:12:12.000Z',
  filters: {
    selected: {
      tenantId: 'tenant-alpha',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-22',
      workflowType: 'all',
    },
    tenants: [
      { id: 'tenant-alpha', name: 'Tenant Alpha' },
      { id: 'tenant-beta', name: 'Tenant Beta' },
    ],
    workflowTypes: [
      { key: 'all', label: 'All workflows' },
      { key: 'problem-solving', label: 'Problem Solving' },
    ],
  },
  freshness: {
    source: 'audit_logs',
    status: 'fresh',
    latestEventAt: '2026-05-22T08:10:00.000Z',
    description: 'Telemetry is current.',
  },
  metrics: {
    quickConsultVolume: 32,
    structuredWorkflowStarts: 12,
    completions: 7,
    incompleteSessions: 5,
    completionRate: 58.3,
    partyModeUsage: 3,
  },
  workflowUsage: [
    {
      workflowKey: 'problem-solving',
      workflowLabel: 'Problem Solving',
      trendPeriod: '2026-05-01 to 2026-05-22',
      starts: 10,
      completions: 3,
      startFailures: 0,
      incompleteSessions: 7,
      completionRate: 30,
      lowCompletion: true,
      drilldown: {
        starts: 10,
        completions: 3,
        startFailures: 0,
        incompleteSessions: 7,
      },
    },
  ],
  instrumentationGaps: [
    {
      eventName: 'thinktank.workflow.mystery',
      reason: 'unknown_event_name',
      owningArea: 'workflow telemetry',
      count: 2,
    },
    {
      eventName: 'thinktank.workflow.started',
      reason: 'event_version_mismatch',
      owningArea: 'Story 1.4 event contract',
      count: 1,
    },
  ],
}

const providerTelemetryDashboard = {
  generatedAt: '2026-05-23T01:30:00.000Z',
  filters: {
    selected: {
      tenantId: 'tenant-alpha',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-22',
      workflowType: 'all',
      groupBy: ['workflow', 'experience', 'provider'],
    },
  },
  freshness: {
    source: 'audit_logs',
    status: 'fresh',
    latestEventAt: '2026-05-22T08:10:00.000Z',
    description: 'Provider telemetry is current.',
  },
  metrics: {
    terminalCalls: 8,
    successfulCalls: 6,
    failedCalls: 2,
    retryEvents: 1,
    errorRate: 25,
    timeoutRate: 12.5,
    estimatedTokens: 12000,
    estimatedCost: 18.75,
    averageLatencyMs: 3400,
    p95LatencyMs: 6200,
    cacheHits: 5,
    cacheMisses: 3,
    cacheBypasses: 1,
    cacheHitRate: 55.56,
  },
  byWorkflow: [
    {
      key: 'problem-solving',
      label: 'Problem Solving',
      scopeLabel: 'workflow',
      terminalCalls: 5,
      failedCalls: 2,
      errorRate: 40,
      timeoutRate: 20,
      estimatedTokens: 9000,
      estimatedCost: 13.5,
      averageLatencyMs: 3600,
      p95LatencyMs: 6400,
      cacheHits: 3,
      cacheMisses: 2,
      cacheBypasses: 0,
      cacheHitRate: 60,
      measurementStatus: 'fresh',
    },
  ],
  byExperience: [
    {
      key: 'quick_consult',
      label: 'Quick Consult',
      scopeLabel: 'experience',
      terminalCalls: 3,
      failedCalls: 0,
      errorRate: 0,
      timeoutRate: 0,
      estimatedTokens: 900,
      estimatedCost: 1.2,
      averageLatencyMs: 1400,
      p95LatencyMs: 2300,
      cacheHits: 2,
      cacheMisses: 1,
      cacheBypasses: 0,
      cacheHitRate: 66.67,
      measurementStatus: 'fresh',
    },
    {
      key: 'party_mode',
      label: 'Party Mode',
      scopeLabel: 'experience',
      terminalCalls: 5,
      failedCalls: 2,
      errorRate: 40,
      timeoutRate: 20,
      estimatedTokens: 11100,
      estimatedCost: 17.55,
      averageLatencyMs: 4600,
      p95LatencyMs: 7200,
      cacheHits: 2,
      cacheMisses: 3,
      cacheBypasses: 1,
      cacheHitRate: 40,
      measurementStatus: 'fresh',
    },
  ],
  byProvider: [
    {
      key: 'zhipu-glm',
      label: 'zhipu-glm',
      scopeLabel: 'provider',
      terminalCalls: 8,
      failedCalls: 2,
      errorRate: 25,
      timeoutRate: 12.5,
      estimatedTokens: 12000,
      estimatedCost: 18.75,
      averageLatencyMs: 3400,
      p95LatencyMs: 6200,
      cacheHits: 5,
      cacheMisses: 3,
      cacheBypasses: 1,
      cacheHitRate: 55.56,
      measurementStatus: 'fresh',
    },
  ],
  thresholdBreaches: [
    {
      id: 'summary-p95-latency',
      metric: 'P95 latency',
      actualValue: '6200 ms',
      thresholdValue: '5000 ms',
      tenantId: 'tenant-alpha',
      affectedScope: 'All provider calls',
      workflowType: 'all',
      timeWindow: '2026-05-01 to 2026-05-22',
      severity: 'warning',
      message:
        'P95 latency breach: 6200 ms exceeds 5000 ms for tenant-alpha across all provider calls during 2026-05-01 to 2026-05-22.',
    },
  ],
  instrumentationGaps: [
    {
      eventName: 'thinktank.provider.call_failed',
      reason: 'missing_grouping_metadata',
      owningArea: 'provider_gateway',
      count: 1,
    },
  ],
}

const qualityFeedbackDashboard = {
  generatedAt: '2026-05-23T02:10:00.000Z',
  filters: {
    selected: {
      tenantId: 'tenant-alpha',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-22',
      workflowType: 'all',
      recommendationType: 'all',
      groupBy: ['workflow', 'recommendationType'],
      timeBucket: 'day',
    },
  },
  freshness: {
    source: 'recommendation_feedback,output_ratings',
    status: 'fresh',
    latestEventAt: '2026-05-22T08:10:00.000Z',
    description: 'Quality feedback is current.',
  },
  metrics: {
    totalRatings: 42,
    averageRating: 3.6,
    lowRatingCount: 9,
    lowRatingRate: 21.43,
    recommendationRatingCount: 24,
    recommendationAverageRating: 3.4,
    recommendationLowRatingRate: 25,
    reportRatingCount: 18,
    reportAverageRating: 3.9,
    reportLowRatingRate: 16.67,
    feedbackTextPresentCount: 11,
    feedbackTextWithheldCount: 11,
    feedbackTextUnavailableReason: 'privacy_policy_withheld',
  },
  ratingDistribution: {
    recommendation: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 4 },
    report: { 1: 1, 2: 2, 3: 3, 4: 7, 5: 5 },
  },
  byWorkflow: [
    {
      key: 'problem-solving',
      label: 'Problem Solving',
      tenantId: 'tenant-alpha',
      ratingCount: 18,
      averageRating: 2.8,
      lowRatingRate: 38.89,
      feedbackTextPresentCount: 6,
      feedbackTextWithheldCount: 6,
      measurementStatus: 'fresh',
    },
  ],
  byRecommendationType: [
    {
      key: 'risk-mitigation',
      label: 'Risk Mitigation',
      workflowKey: 'problem-solving',
      tenantId: 'tenant-alpha',
      ratingCount: 12,
      averageRating: 2.6,
      lowRatingRate: 41.67,
    },
  ],
  lowQualityTrends: [
    {
      id: 'problem-solving-risk-mitigation',
      workflowLabel: 'Problem Solving',
      recommendationLabel: 'Risk Mitigation',
      tenantId: 'tenant-alpha',
      trendDirection: 'up',
      currentLowRatingRate: 41.67,
      previousLowRatingRate: 18.18,
      sampleSize: 12,
      severity: 'warning',
    },
  ],
  instrumentationGaps: [
    {
      eventName: 'recommendation_feedback',
      reason: 'missing_recommendation_category',
      owningArea: 'quick_consult_feedback',
      count: 2,
    },
  ],
}

describe('AdvisoryOperationsPage', () => {
  const mockFetchUsage = fetchAdvisoryOperationsUsage as jest.MockedFunction<
    typeof fetchAdvisoryOperationsUsage
  >
  const mockFetchProviderTelemetry = (
    jest.requireMock('@/lib/advisory/operations') as {
      fetchAdvisoryProviderTelemetry: jest.Mock
    }
  ).fetchAdvisoryProviderTelemetry
  const mockFetchQualityFeedback = (
    jest.requireMock('@/lib/advisory/operations') as {
      fetchAdvisoryQualityFeedback: jest.Mock
    }
  ).fetchAdvisoryQualityFeedback

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchUsage.mockResolvedValue(dashboard)
    mockFetchProviderTelemetry.mockResolvedValue(providerTelemetryDashboard)
    mockFetchQualityFeedback.mockResolvedValue(qualityFeedbackDashboard)
  })

  it('renders filters, usage metrics, workflow table, freshness, and instrumentation gaps', async () => {
    render(<AdvisoryOperationsPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /ThinkTank Operations/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('combobox', { name: /Tenant/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Date from/i)).toHaveValue('2026-05-01')
    expect(screen.getByLabelText(/Date to/i)).toHaveValue('2026-05-22')
    expect(screen.getByRole('combobox', { name: /Workflow type/i })).toBeInTheDocument()

    const metrics = screen.getByRole('region', { name: /Usage metrics/i })
    expect(metrics).toHaveTextContent('Quick Consult volume')
    expect(metrics).toHaveTextContent('32')
    expect(metrics).toHaveTextContent('Structured workflow starts')
    expect(metrics).toHaveTextContent('12')
    expect(metrics).toHaveTextContent('Incomplete sessions')
    expect(metrics).toHaveTextContent('5')
    expect(metrics).toHaveTextContent('Party Mode usage')
    expect(metrics).toHaveTextContent('3')

    const table = screen.getByRole('table', { name: /Workflow completion/i })
    expect(table).toHaveTextContent('Problem Solving')
    expect(table).toHaveTextContent('30%')
    expect(table).toHaveTextContent('Low completion')

    const gaps = screen.getByRole('region', { name: /Instrumentation gaps/i })
    expect(gaps).toHaveTextContent(/unknown event name/i)
    expect(gaps).toHaveTextContent(/wrong event version/i)
  })

  it('applies date filters and opens aggregate drilldown without raw content', async () => {
    render(<AdvisoryOperationsPage />)

    await screen.findByRole('heading', { name: /ThinkTank Operations/i })
    fireEvent.change(screen.getByLabelText(/Date from/i), { target: { value: '2026-05-02' } })
    fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }))

    await waitFor(() => {
      expect(mockFetchUsage).toHaveBeenLastCalledWith(
        expect.objectContaining({ dateFrom: '2026-05-02' })
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /Drill down/i }))
    const drilldown = screen.getByRole('dialog', {
      name: /Problem Solving completion drilldown/i,
    })

    expect(drilldown).toHaveTextContent('Aggregated counts')
    expect(drilldown).toHaveTextContent('Starts')
    expect(drilldown).toHaveTextContent('10')
    expect(JSON.stringify(drilldown.textContent)).not.toMatch(
      /PRIVATE_|prompt|conversation|report|feedback/i
    )
  })

  it('shows unavailable telemetry state without rendering misleading zero metrics', async () => {
    mockFetchUsage.mockResolvedValue({
      ...dashboard,
      freshness: {
        source: 'audit_logs',
        status: 'unavailable',
        latestEventAt: null,
        description: 'No trusted measurements are available.',
      },
      metrics: null,
      workflowUsage: [],
      instrumentationGaps: [],
    })

    render(<AdvisoryOperationsPage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Telemetry unavailable|Usage data unavailable/i)
    expect(alert).toHaveTextContent(/No trusted measurements|try again/i)
    expect(screen.queryByText(/Quick Consult volume\s+0/i)).not.toBeInTheDocument()
  })

  it('[6.3-COMP-001][P1][AC1] renders provider telemetry metrics and grouped monitoring views', async () => {
    render(<AdvisoryOperationsPage />)

    const providerMetrics = await screen.findByRole('region', {
      name: /Provider telemetry metrics/i,
    })
    expect(providerMetrics).toHaveTextContent('Average latency')
    expect(providerMetrics).toHaveTextContent('3400 ms')
    expect(providerMetrics).toHaveTextContent('P95 latency')
    expect(providerMetrics).toHaveTextContent('6200 ms')
    expect(providerMetrics).toHaveTextContent('Error rate')
    expect(providerMetrics).toHaveTextContent('25%')
    expect(providerMetrics).toHaveTextContent('Timeout rate')
    expect(providerMetrics).toHaveTextContent('12.5%')
    expect(providerMetrics).toHaveTextContent('Estimated tokens')
    expect(providerMetrics).toHaveTextContent('12,000')
    expect(providerMetrics).toHaveTextContent('Estimated cost')
    expect(providerMetrics).toHaveTextContent('18.75')
    expect(providerMetrics).toHaveTextContent('Cache hit rate')
    expect(providerMetrics).toHaveTextContent('55.6%')

    const providerTable = screen.getByRole('table', { name: /Provider telemetry groups/i })
    expect(providerTable).toHaveTextContent('Problem Solving')
    expect(providerTable).toHaveTextContent('Quick Consult')
    expect(providerTable).toHaveTextContent('Party Mode')
    expect(providerTable).toHaveTextContent('zhipu-glm')
  })

  it('[6.3-COMP-002][P1][AC2] identifies threshold breaches with text, icon labeling, tenant, scope, and time window', async () => {
    render(<AdvisoryOperationsPage />)

    const breaches = await screen.findByRole('region', { name: /Provider threshold breaches/i })
    expect(breaches).toHaveTextContent(/Warning breach/i)
    expect(breaches).toHaveTextContent('P95 latency')
    expect(breaches).toHaveTextContent('6200 ms')
    expect(breaches).toHaveTextContent('5000 ms')
    expect(breaches).toHaveTextContent('tenant-alpha')
    expect(breaches).toHaveTextContent('Workflow type: all')
    expect(breaches).toHaveTextContent('All provider calls')
    expect(breaches).toHaveTextContent('2026-05-01 to 2026-05-22')
  })

  it('[6.3-COMP-004][P1][AC1,AC3] renders provider telemetry instrumentation gaps', async () => {
    render(<AdvisoryOperationsPage />)

    const gaps = await screen.findByRole('region', { name: /Provider telemetry gaps/i })
    expect(gaps).toHaveTextContent(/missing grouping metadata/i)
    expect(gaps).toHaveTextContent('thinktank.provider.call_failed')
    expect(gaps).toHaveTextContent('provider_gateway')
  })

  it('[6.3-COMP-003][P1][AC3] renders unavailable provider telemetry without misleading zero measurements or raw content', async () => {
    mockFetchProviderTelemetry.mockResolvedValue({
      ...providerTelemetryDashboard,
      freshness: {
        source: 'audit_logs',
        status: 'unavailable',
        latestEventAt: null,
        description:
          'Provider telemetry source is unavailable. No trusted measurements are available.',
      },
      metrics: null,
      byWorkflow: [],
      byExperience: [],
      byProvider: [],
      thresholdBreaches: [],
      instrumentationGaps: [],
    })

    render(<AdvisoryOperationsPage />)

    const alert = await screen.findByRole('alert', { name: /Provider telemetry unavailable/i })
    expect(alert).toHaveTextContent(/No trusted measurements/i)
    expect(screen.queryByText(/Average latency\s+0 ms/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Estimated cost\s+0/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/PRIVATE_|raw prompt|conversation|report content|raw feedback/i)
    ).not.toBeInTheDocument()
  })

  describe('Story 6.4 quality feedback dashboard', () => {
    it('[6.4-COMP-001][P1][AC1] renders quality feedback section inside the existing operations page', async () => {
      render(<AdvisoryOperationsPage />)

      const quality = await screen.findByRole('region', { name: /Quality feedback/i })
      expect(quality).toHaveTextContent('Average rating')
      expect(quality).toHaveTextContent('Low-rating rate')
      expect(quality).toHaveTextContent('Sample size')
      expect(screen.getByRole('heading', { name: /ThinkTank Operations/i })).toBeInTheDocument()
    })

    it('[6.4-COMP-002][P1][AC1] displays aggregate recommendation and report rating metrics and distribution', async () => {
      render(<AdvisoryOperationsPage />)

      const quality = await screen.findByRole('region', { name: /Quality feedback/i })
      expect(quality).toHaveTextContent('3.6')
      expect(quality).toHaveTextContent('21.4%')
      expect(quality).toHaveTextContent('Recommendation ratings')
      expect(quality).toHaveTextContent('Report ratings')
      expect(quality).toHaveTextContent('1')
      expect(quality).toHaveTextContent('5')
    })

    it('[6.4-COMP-003][P1][AC2] displays low-quality affected workflow and category rows with text trend direction', async () => {
      render(<AdvisoryOperationsPage />)

      const trends = await screen.findByRole('region', { name: /Low-quality trends/i })
      expect(trends).toHaveTextContent('Problem Solving')
      expect(trends).toHaveTextContent('Risk Mitigation')
      expect(trends).toHaveTextContent(/up|worsening/i)
      expect(trends).toHaveTextContent('41.7%')
    })

    it('[6.4-COMP-004][P1][AC1] displays feedback text present and withheld counts without raw text', async () => {
      render(<AdvisoryOperationsPage />)

      const quality = await screen.findByRole('region', { name: /Quality feedback/i })
      expect(quality).toHaveTextContent(/Feedback text present/i)
      expect(quality).toHaveTextContent('11')
      expect(quality).toHaveTextContent(/withheld/i)
      expect(JSON.stringify(quality.textContent)).not.toMatch(
        /PRIVATE_|raw feedback|report content/i
      )
    })

    it('[6.4-COMP-005][P1][AC3] renders only current tenant aggregates in tenant admin view', async () => {
      render(<AdvisoryOperationsPage />)

      const workflowTable = await screen.findByRole('table', {
        name: /Quality feedback by workflow/i,
      })
      expect(workflowTable).toHaveTextContent('tenant-alpha')
      expect(workflowTable).not.toHaveTextContent('tenant-beta')
      expect(workflowTable).not.toHaveTextContent(/cross-tenant/i)
    })

    it('[6.4-COMP-006][P1][AC1,AC2] shared filters trigger quality feedback reload with tenant date and workflow filters', async () => {
      render(<AdvisoryOperationsPage />)

      await screen.findByRole('heading', { name: /ThinkTank Operations/i })
      fireEvent.change(screen.getByLabelText(/Date from/i), { target: { value: '2026-05-02' } })
      fireEvent.click(screen.getByRole('button', { name: /Apply filters/i }))

      await waitFor(() => {
        expect(mockFetchQualityFeedback).toHaveBeenLastCalledWith(
          expect.objectContaining({ dateFrom: '2026-05-02', workflowType: 'all' })
        )
      })
    })

    it('[6.4-COMP-007][P1][AC2] unavailable quality feedback shows trusted unavailable state and no zero-success metrics', async () => {
      mockFetchQualityFeedback.mockResolvedValue({
        ...qualityFeedbackDashboard,
        freshness: {
          source: 'recommendation_feedback,output_ratings',
          status: 'unavailable',
          latestEventAt: null,
          description: 'Quality feedback unavailable. No trusted measurements are available.',
        },
        metrics: null,
        byWorkflow: [],
        byRecommendationType: [],
        lowQualityTrends: [],
      })

      render(<AdvisoryOperationsPage />)

      const alert = await screen.findByRole('alert', { name: /Quality feedback unavailable/i })
      expect(alert).toHaveTextContent(/No trusted measurements/i)
      expect(screen.queryByText(/Average rating\s+0/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Low-rating rate\s+0%/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Healthy/i)).not.toBeInTheDocument()
    })

    it('[6.4-COMP-008][P0][AC1,AC2,AC3] raw privacy sentinel strings are absent from rendered DOM', async () => {
      mockFetchQualityFeedback.mockResolvedValue({
        ...qualityFeedbackDashboard,
        rawFeedbackText: 'PRIVATE_FEEDBACK_DO_NOT_RENDER',
        reportContent: 'PRIVATE_REPORT_DO_NOT_RENDER',
        prompt: 'PRIVATE_PROMPT_DO_NOT_RENDER',
        conversation: 'PRIVATE_CONVERSATION_DO_NOT_RENDER',
      })

      render(<AdvisoryOperationsPage />)

      await screen.findByRole('region', { name: /Quality feedback/i })
      expect(
        screen.queryByText(/PRIVATE_|raw feedback|raw prompt|conversation|report content/i)
      ).not.toBeInTheDocument()
    })
  })
})
