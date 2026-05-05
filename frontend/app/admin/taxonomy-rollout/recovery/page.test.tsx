import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockPush = jest.fn()
const mockUseSession = jest.fn(() => ({
  data: { user: { id: 'admin-1', role: 'admin', name: 'Admin' } },
  status: 'authenticated',
}))
const mockSearchParams: { get: jest.Mock<string | null, [string]> } = {
  get: jest.fn<string | null, [string]>(() => null),
}
const mockFetchRolloutPolicies = jest.fn()
const mockFetchRolloutPolicyByL1Code = jest.fn()
const mockFetchTaxonomyRolloutReports = jest.fn()
const mockReclassifyTaxonomyCases = jest.fn()
const mockBackfillTaxonomyCases = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

jest.mock('@/components/ui/select', () => {
  type SelectItemData = { value: string; children: React.ReactNode }

  const SelectItem = ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  )

  const collectItems = (children: React.ReactNode): SelectItemData[] => {
    const items: SelectItemData[] = []
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return
      if (child.type === SelectItem) {
        items.push({ value: child.props.value, children: child.props.children })
        return
      }
      if ('children' in child.props && child.props.children) {
        items.push(...collectItems(child.props.children))
      }
    })
    return items
  }

  const Select = ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) => {
    const items = collectItems(children)
    return (
      <select
        aria-label="mock-select"
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.children}
          </option>
        ))}
      </select>
    )
  }

  const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>
  const SelectTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const SelectValue = () => null

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/lib/api/taxonomy-rollout', () => ({
  backfillTaxonomyCases: (...args: unknown[]) => mockBackfillTaxonomyCases(...args),
  buildTaxonomyRolloutReportUrl: (reportPath: string | null | undefined) => {
    const normalizedReportPath = reportPath?.trim()
    if (!normalizedReportPath) return null
    return `/api/admin/knowledge-graph/taxonomy-rollout/retirement/report?path=${encodeURIComponent(normalizedReportPath)}`
  },
  fetchRolloutPolicies: (...args: unknown[]) => mockFetchRolloutPolicies(...args),
  fetchRolloutPolicyByL1Code: (...args: unknown[]) => mockFetchRolloutPolicyByL1Code(...args),
  fetchTaxonomyRolloutReports: (...args: unknown[]) => mockFetchTaxonomyRolloutReports(...args),
  reclassifyTaxonomyCases: (...args: unknown[]) => mockReclassifyTaxonomyCases(...args),
}))

const listPolicies = [
  {
    id: 'p4',
    l1Code: 'IT04',
    rolloutState: 'domain-primary',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'taxonomy-classifier-6.6',
    primaryThreshold: 0.7,
    shadowWindowDays: 14,
    stateChangedAt: '2026-05-01T00:00:00.000Z',
    stateAllowsPrimary: true,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: true,
  },
  {
    id: 'p7',
    l1Code: 'IT07',
    rolloutState: 'domain-primary',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'taxonomy-classifier-6.6',
    primaryThreshold: 0.78,
    shadowWindowDays: 14,
    stateChangedAt: '2026-05-01T00:00:00.000Z',
    stateAllowsPrimary: true,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: true,
  },
]

const detailPolicy = {
  ...listPolicies[0],
  mappingOwner: 'team-alpha',
  rulebookOwner: 'team-beta',
  benchmarkOwner: 'team-gamma',
  gateApprover: 'lead-1',
  rollbackApprover: 'lead-2',
  cutoverThresholdsJson: { canaryPercentage: 10, errorBudget: 0.02 },
  retirementThresholdsJson: {
    rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
  },
  retirementEvidenceJson: {
    lastCutoverAt: '2026-05-01T00:00:00.000Z',
    lastCutoverReleaseId: 'rel-001',
    lastLegacyOffAt: '2026-05-03T02:10:00.000Z',
    lastLegacyOffReleaseId: 'kg-v2-r3',
    lastKillSwitchDrillAt: '2026-05-02T00:00:00.000Z',
    lastRollbackVerifiedAt: '2026-05-02T08:00:00.000Z',
    lastReclassifyVerifiedAt: '2026-05-04T09:00:00.000Z',
    lastBackfillVerifiedAt: '2026-05-04T10:00:00.000Z',
    lastSmokeVerifiedAt: '2026-05-03T02:10:15.000Z',
    lastRetirementReportPath: '/reports/taxonomy-retirement/IT04-kg-v2-r3.json',
  },
  updatedAt: '2026-05-04T10:00:00.000Z',
}

const reportsPage1 = {
  items: [
    {
      id: 'hist-reclassify-1',
      l1Code: 'IT04',
      type: 'reclassify',
      status: 'completed',
      createdAt: '2026-05-04T09:00:00.000Z',
      summary: 'Reclassify dry-run completed for batch kg-v2-r3',
      reportPath: '/reports/taxonomy-recovery/reclassify/IT04-dry-run.json',
      evidenceLink: '/reports/taxonomy-recovery/reclassify/IT04-smoke.json',
    },
    {
      id: 'hist-retirement-1',
      l1Code: 'IT04',
      type: 'retirement',
      status: 'completed',
      createdAt: '2026-05-03T02:10:00.000Z',
      summary: 'Retirement report generated',
      reportPath: '/reports/taxonomy-retirement/IT04-kg-v2-r3.json',
      evidenceLink: '/reports/taxonomy-retirement/IT04-smoke.json',
    },
  ],
  page: 1,
  limit: 2,
  total: 3,
  hasNextPage: true,
}

const reportsPage2 = {
  items: [
    {
      id: 'hist-rollback-1',
      l1Code: 'IT04',
      type: 'rollback',
      status: 'completed',
      createdAt: '2026-05-02T08:00:00.000Z',
      summary: 'Rollback verification evidence recorded',
      reportPath: '/reports/taxonomy-retirement/IT04-rollback.json',
      evidenceLink: '/reports/taxonomy-retirement/IT04-rollback-smoke.json',
    },
  ],
  page: 2,
  limit: 2,
  total: 3,
  hasNextPage: false,
}

const reclassifyResult = {
  operation: 'reclassify',
  l1Code: 'IT04',
  dryRun: true,
  shadowOnly: true,
  processedCount: 3,
  affectedDomains: ['IT04'],
  latestPointerUpdated: false,
  classifierVersion: 'taxonomy-classifier-6.7',
  summary: 'Dry-run reclassified 3 cases for IT04 without updating latest pointers.',
  reportPath: '/reports/taxonomy-recovery/reclassify/IT04-dry-run.json',
  auditId: 'audit-reclassify-1',
}

const backfillResult = {
  operation: 'backfill',
  l1Code: 'IT04',
  dryRun: false,
  processedCount: 2,
  affectedDomains: ['IT04'],
  latestPointerUpdated: false,
  classifierVersion: null,
  summary: 'Backfill execution completed for 2 scoped cases.',
  reportPath: '/reports/taxonomy-recovery/backfill/IT04-execute.json',
  auditId: 'audit-backfill-1',
}

async function renderPage() {
  const modulePath = './page' as string
  const pageModule = await import(modulePath)
  render(React.createElement(pageModule.default))
}

describe('TaxonomyRolloutRecoveryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'l1Code') return 'IT04'
      return null
    })
    mockFetchRolloutPolicies.mockResolvedValue(listPolicies)
    mockFetchRolloutPolicyByL1Code.mockResolvedValue(detailPolicy)
    mockFetchTaxonomyRolloutReports.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve(page === 2 ? reportsPage2 : reportsPage1)
    )
    mockReclassifyTaxonomyCases.mockResolvedValue(reclassifyResult)
    mockBackfillTaxonomyCases.mockResolvedValue(backfillResult)
  })

  test('[8.4-RTL-001][P0] preselects l1Code from query params and loads paginated history with page and limit', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'l1Code') return 'it07'
      return null
    })
    mockFetchRolloutPolicyByL1Code.mockResolvedValue({ ...detailPolicy, ...listPolicies[1] })

    await renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Taxonomy Rollout Recovery Console' })
      ).toBeInTheDocument()
    })

    const selects = screen.getAllByLabelText('mock-select') as HTMLSelectElement[]
    expect(selects[0].value).toBe('IT07')
    await waitFor(() => {
      expect(mockFetchRolloutPolicyByL1Code).toHaveBeenCalledWith('IT07')
      expect(mockFetchTaxonomyRolloutReports).toHaveBeenCalledWith({
        l1Code: 'IT07',
        page: 1,
        limit: 2,
        dateFrom: undefined,
        dateTo: undefined,
      })
    })
  })

  test('[8.4-RTL-002][P0] renders operation selector and recovery form fields', async () => {
    await renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Taxonomy Rollout Recovery Console' })
      ).toBeInTheDocument()
    })

    expect(screen.getByText('Domain')).toBeVisible()
    expect(screen.getByText('Operation')).toBeVisible()
    expect(screen.getByLabelText('Batch ID')).toBeVisible()
    expect(screen.getByLabelText('Case IDs')).toBeVisible()
    expect(screen.getByLabelText('Classifier Version')).toBeVisible()
    expect(screen.getByLabelText('Shadow Only')).toBeVisible()
    expect(screen.getByLabelText('Dry Run')).toBeVisible()

    fireEvent.change(screen.getAllByLabelText('mock-select')[1], { target: { value: 'backfill' } })
    expect(screen.getByRole('button', { name: 'Run Backfill' })).toBeVisible()
  })

  test('[8.4-RTL-003][P0] dedupes caseIds, sends dryRun/shadowOnly payload, and renders success result', async () => {
    await renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Taxonomy Rollout Recovery Console' })
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Batch ID'), { target: { value: ' kg-v2-r3 ' } })
    fireEvent.change(screen.getByLabelText('Case IDs'), {
      target: { value: 'case-101, case-101\ncase-202\n\ncase-303' },
    })
    fireEvent.change(screen.getByLabelText('Classifier Version'), {
      target: { value: ' taxonomy-classifier-6.7 ' },
    })
    fireEvent.click(screen.getByLabelText('Shadow Only'))
    fireEvent.click(screen.getByRole('button', { name: 'Run Reclassify Dry Run' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Confirm Reclassify' })).toBeVisible()
    expect(within(dialog).getByText('IT04')).toBeVisible()
    expect(within(dialog).getByText('Reclassify')).toBeVisible()
    expect(within(dialog).getByText('Batch kg-v2-r3 + 3 case IDs')).toBeVisible()
    expect(within(dialog).getByText('taxonomy-classifier-6.7')).toBeVisible()
    expect(within(dialog).getAllByText('Yes').length).toBeGreaterThanOrEqual(2)

    fireEvent.change(within(dialog).getByLabelText('Type Domain Code to Confirm'), {
      target: { value: 'IT04' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Reclassify' }))

    await waitFor(() => {
      expect(mockReclassifyTaxonomyCases).toHaveBeenCalledWith({
        l1Code: 'IT04',
        batchId: 'kg-v2-r3',
        caseIds: ['case-101', 'case-202', 'case-303'],
        classifierVersion: 'taxonomy-classifier-6.7',
        shadowOnly: true,
        dryRun: true,
        confirmationText: 'IT04',
      })
    })

    expect(
      screen.getByText('Dry-run reclassified 3 cases for IT04 without updating latest pointers.')
    ).toBeVisible()
    expect(screen.getByText('Processed Count')).toBeVisible()
    expect(screen.getByText('Affected Domains')).toBeVisible()
    expect(screen.getByText('Latest Pointer Updated')).toBeVisible()
    expect(screen.getAllByText('Classifier Version').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText('/reports/taxonomy-recovery/reclassify/IT04-dry-run.json').length
    ).toBeGreaterThan(0)
  })

  test('[8.4-RTL-004][P0] submits backfill execute payload through the confirmation dialog', async () => {
    await renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Taxonomy Rollout Recovery Console' })
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getAllByLabelText('mock-select')[1], { target: { value: 'backfill' } })
    fireEvent.change(screen.getByLabelText('Batch ID'), { target: { value: 'kg-v2-r3' } })
    fireEvent.change(screen.getByLabelText('Case IDs'), {
      target: { value: 'case-404\ncase-405' },
    })
    fireEvent.click(screen.getByLabelText('Dry Run'))
    fireEvent.click(screen.getByRole('button', { name: 'Run Backfill' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Confirm Backfill' })).toBeVisible()
    expect(within(dialog).getByText('Backfill')).toBeVisible()
    expect(within(dialog).getAllByText('No').length).toBeGreaterThan(0)
    fireEvent.change(within(dialog).getByLabelText('Type Domain Code to Confirm'), {
      target: { value: 'IT04' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Backfill' }))

    await waitFor(() => {
      expect(mockBackfillTaxonomyCases).toHaveBeenCalledWith({
        l1Code: 'IT04',
        batchId: 'kg-v2-r3',
        caseIds: ['case-404', 'case-405'],
        shadowOnly: false,
        dryRun: false,
        confirmationText: 'IT04',
      })
    })
  })

  test('[8.4-RTL-005][P0] keeps mutation failures in dialog and leaves an operator-readable page error after close', async () => {
    const blockedError = Object.assign(
      new Error('Reclassify blocked because latest pointer update is not allowed'),
      {
        status: 409,
        code: 'RECLASSIFY_BLOCKED',
        auditId: 'audit-reclassify-failed-1',
      }
    )
    mockReclassifyTaxonomyCases.mockRejectedValueOnce(blockedError)

    await renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Taxonomy Rollout Recovery Console' })
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Batch ID'), { target: { value: 'kg-v2-r3' } })
    fireEvent.change(screen.getByLabelText('Case IDs'), { target: { value: 'case-501' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run Reclassify Dry Run' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Type Domain Code to Confirm'), {
      target: { value: 'IT04' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Reclassify' }))

    await waitFor(() => {
      expect(within(screen.getByRole('dialog')).getByText('RECLASSIFY_BLOCKED')).toBeVisible()
      expect(
        within(screen.getByRole('dialog')).getByText(
          'Reclassify blocked because latest pointer update is not allowed'
        )
      ).toBeVisible()
      expect(
        within(screen.getByRole('dialog')).getByText('Audit ID: audit-reclassify-failed-1')
      ).toBeVisible()
    })

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))

    expect(screen.getByText('RECLASSIFY_BLOCKED')).toBeVisible()
    expect(screen.getByText('Audit ID: audit-reclassify-failed-1')).toBeVisible()
    expect(screen.getByText('Operator review required')).toBeVisible()
  })

  test('[8.4-RTL-006][P1] applies history date filters and paginates with server-side page requests', async () => {
    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Reclassify dry-run completed for batch kg-v2-r3')).toBeVisible()
    })
    expect(screen.getByText('Retirement report generated')).toBeVisible()

    fireEvent.change(screen.getByLabelText('Date From'), { target: { value: '2026-05-01' } })
    fireEvent.change(screen.getByLabelText('Date To'), { target: { value: '2026-05-04' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }))

    await waitFor(() => {
      expect(mockFetchTaxonomyRolloutReports).toHaveBeenCalledWith({
        l1Code: 'IT04',
        page: 1,
        limit: 2,
        dateFrom: '2026-05-01',
        dateTo: '2026-05-04',
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Next Page' }))

    await waitFor(() => {
      expect(mockFetchTaxonomyRolloutReports).toHaveBeenCalledWith({
        l1Code: 'IT04',
        page: 2,
        limit: 2,
        dateFrom: '2026-05-01',
        dateTo: '2026-05-04',
      })
      expect(screen.getByText('Rollback verification evidence recorded')).toBeVisible()
    })
  })
})
