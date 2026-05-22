import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AdvisoryOperationsPage from './page'
import { fetchAdvisoryOperationsUsage } from '@/lib/advisory/operations'

jest.mock('@/lib/advisory/operations', () => ({
  fetchAdvisoryOperationsUsage: jest.fn(),
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

describe('AdvisoryOperationsPage', () => {
  const mockFetchUsage = fetchAdvisoryOperationsUsage as jest.MockedFunction<
    typeof fetchAdvisoryOperationsUsage
  >

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchUsage.mockResolvedValue(dashboard)
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
        expect.objectContaining({ dateFrom: '2026-05-02' }),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /Drill down/i }))
    const drilldown = screen.getByRole('dialog', {
      name: /Problem Solving completion drilldown/i,
    })

    expect(drilldown).toHaveTextContent('Aggregated counts')
    expect(drilldown).toHaveTextContent('Starts')
    expect(drilldown).toHaveTextContent('10')
    expect(JSON.stringify(drilldown.textContent)).not.toMatch(/PRIVATE_|prompt|conversation|report|feedback/i)
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
})
