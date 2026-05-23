import { render, screen, waitFor } from '@testing-library/react'
import AdvisoryOperationsPage from './page'

jest.mock('@/lib/advisory/operations', () => ({
  fetchAdvisoryOperationsUsage: jest.fn(),
  fetchAdvisoryProviderTelemetry: jest.fn(),
  fetchAdvisoryQualityFeedback: jest.fn(),
  fetchAdvisoryGovernanceReview: jest.fn(),
}))

const baseUsageDashboard = {
  generatedAt: '2026-05-22T08:12:12.000Z',
  filters: {
    selected: {
      tenantId: 'tenant-alpha',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-22',
      workflowType: 'all',
    },
    tenants: [{ id: 'tenant-alpha', name: 'Tenant Alpha' }],
    workflowTypes: [{ key: 'all', label: 'All workflows' }],
  },
  freshness: {
    source: 'audit_logs',
    status: 'fresh',
    latestEventAt: '2026-05-22T08:10:00.000Z',
    description: 'Telemetry is current.',
  },
  metrics: {
    quickConsultVolume: 1,
    structuredWorkflowStarts: 1,
    completions: 1,
    incompleteSessions: 0,
    completionRate: 100,
    partyModeUsage: 0,
  },
  workflowUsage: [],
  instrumentationGaps: [],
}

const emptyProviderTelemetry = {
  generatedAt: '2026-05-23T01:30:00.000Z',
  filters: {
    selected: {
      tenantId: 'tenant-alpha',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-22',
      workflowType: 'all',
      groupBy: [],
    },
  },
  freshness: { source: 'audit_logs', status: 'fresh', latestEventAt: null, description: 'Fresh.' },
  metrics: null,
  byWorkflow: [],
  byExperience: [],
  byProvider: [],
  thresholdBreaches: [],
  instrumentationGaps: [],
}

const emptyQualityFeedback = {
  generatedAt: '2026-05-23T02:10:00.000Z',
  filters: {
    selected: {
      tenantId: 'tenant-alpha',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-22',
      workflowType: 'all',
      recommendationType: 'all',
      groupBy: [],
      timeBucket: 'day',
    },
  },
  freshness: {
    source: 'quality_feedback',
    status: 'fresh',
    latestEventAt: null,
    description: 'Fresh.',
  },
  metrics: null,
  ratingDistribution: {
    recommendation: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    report: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  },
  feedbackText: { presentCount: 0, withheldCount: 0, unavailableReason: null },
  byWorkflow: [],
  byRecommendationType: [],
  lowQualityTrends: [],
  instrumentationGaps: [],
}

const governanceDashboard = {
  generatedAt: '2026-05-23T04:15:00.000Z',
  filters: {
    selected: {
      tenantId: 'tenant-alpha',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-22',
      workflowType: 'all',
      actorId: '',
      eventType: 'all',
      outcome: 'all',
      groupBy: ['eventType', 'outcome', 'actor', 'workflow'],
    },
  },
  freshness: {
    source: 'audit_logs',
    status: 'fresh',
    latestEventAt: '2026-05-22T08:10:00.000Z',
    description: 'Governance review is current.',
  },
  metrics: {
    totalEvents: 18,
    trustedEvents: 15,
    malformedEvents: 3,
    deniedActions: 2,
    exportedOutputs: 3,
    exportsMissingAiLabelMetadata: 1,
    complianceIssueCount: 2,
  },
  byEventType: [
    {
      key: 'thinktank.output.exported',
      label: 'thinktank.output.exported',
      count: 3,
      deniedCount: 0,
      owningArea: 'report export',
      owningStory: 'Story 2.9 report export',
    },
  ],
  byOutcome: [{ key: 'denied', label: 'denied', count: 2 }],
  byActor: [
    { key: 'actor-42', label: 'actor-42', count: 7, deniedCount: 1, exportedOutputCount: 2 },
  ],
  byWorkflow: [
    {
      key: 'problem-solving',
      label: 'Problem Solving',
      count: 9,
      deniedCount: 1,
      exportedOutputCount: 2,
    },
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
      message: 'AI label metadata missing.',
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
}

describe('Story 6.5 operations page governance ATDD (RED)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const operations = jest.requireMock('@/lib/advisory/operations')
    operations.fetchAdvisoryOperationsUsage.mockResolvedValue(baseUsageDashboard)
    operations.fetchAdvisoryProviderTelemetry.mockResolvedValue(emptyProviderTelemetry)
    operations.fetchAdvisoryQualityFeedback.mockResolvedValue(emptyQualityFeedback)
    operations.fetchAdvisoryGovernanceReview.mockResolvedValue(governanceDashboard)
  })

  it('[6.5-COMP-001][P1][AC1,AC2,AC3,AC4] renders governance review summaries compliance issues and gaps without raw content', async () => {
    render(<AdvisoryOperationsPage />)

    const governance = await screen.findByRole('region', { name: /Governance review/i })
    expect(governance).toHaveTextContent('Trusted events')
    expect(governance).toHaveTextContent('15')
    expect(governance).toHaveTextContent('Exports missing AI labels')
    expect(governance).toHaveTextContent('1')

    expect(
      screen.getByRole('table', { name: /Governance events by event type/i })
    ).toHaveTextContent('thinktank.output.exported')
    expect(screen.getByRole('table', { name: /Exported output AI labeling/i })).toHaveTextContent(
      /Missing AI label metadata|Compliance issue/i
    )
    expect(screen.getByRole('region', { name: /Governance compliance issues/i })).toHaveTextContent(
      'Story 2.9 report export'
    )
    expect(screen.getByRole('region', { name: /Governance evidence gaps/i })).toHaveTextContent(
      'Story 3.4 workflow completion'
    )
    expect(
      screen.queryByText(/PRIVATE_|raw prompt|report content|provider payload|cache key/i)
    ).not.toBeInTheDocument()
  })

  it('[6.5-COMP-002][P1][AC3] renders unavailable governance state without misleading healthy zeroes', async () => {
    const operations = jest.requireMock('@/lib/advisory/operations')
    operations.fetchAdvisoryGovernanceReview.mockResolvedValue({
      ...governanceDashboard,
      freshness: {
        source: 'audit_logs',
        status: 'unavailable',
        latestEventAt: null,
        description: 'Governance review unavailable. No trusted measurements are available.',
      },
      metrics: null,
      byEventType: [],
      byOutcome: [],
      byActor: [],
      byWorkflow: [],
      exportedOutputs: [],
      complianceIssues: [],
      instrumentationGaps: [],
    })

    render(<AdvisoryOperationsPage />)

    const alert = await screen.findByRole('alert', { name: /Governance review unavailable/i })
    expect(alert).toHaveTextContent(/No trusted measurements/i)
    await waitFor(() => {
      expect(screen.queryByText(/Trusted events\s+0/i)).not.toBeInTheDocument()
    })
    expect(screen.getByText(/Compliance issues cannot be determined/i)).toBeInTheDocument()
    expect(screen.getByText(/Exported output evidence cannot be determined/i)).toBeInTheDocument()
    expect(screen.getByText(/Event groups cannot be determined/i)).toBeInTheDocument()
    expect(screen.queryByText(/No governance compliance issues detected/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/No exported output governance events are available/i)
    ).not.toBeInTheDocument()
  })
})
