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
const mockEvaluateRetirementDryRun = jest.fn()
const mockExecuteTaxonomyRetirement = jest.fn()
const mockRollbackTaxonomyRetirement = jest.fn()

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
  buildTaxonomyRetirementReportUrl: (reportPath: string | null | undefined) => {
    const normalizedReportPath = reportPath?.trim()
    if (!normalizedReportPath) return null
    const normalizedSlashes = normalizedReportPath.replace(/\\/g, '/')
    if (
      !/^\/?reports\/taxonomy-retirement\/[^/]+\.json$/i.test(normalizedSlashes) &&
      !/^taxonomy-retirement\/[^/]+\.json$/i.test(normalizedSlashes)
    )
      return null
    return `/api/admin/knowledge-graph/taxonomy-rollout/retirement/report?path=${encodeURIComponent(normalizedReportPath)}`
  },
  fetchRolloutPolicies: (...args: unknown[]) => mockFetchRolloutPolicies(...args),
  fetchRolloutPolicyByL1Code: (...args: unknown[]) => mockFetchRolloutPolicyByL1Code(...args),
  evaluateRetirementDryRun: (...args: unknown[]) => mockEvaluateRetirementDryRun(...args),
  executeTaxonomyRetirement: (...args: unknown[]) => mockExecuteTaxonomyRetirement(...args),
  rollbackTaxonomyRetirement: (...args: unknown[]) => mockRollbackTaxonomyRetirement(...args),
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
    lastLegacyOffAt: null,
    lastLegacyOffReleaseId: null,
    lastKillSwitchDrillAt: '2026-05-02T00:00:00.000Z',
    lastRollbackVerifiedAt: null,
    lastReclassifyVerifiedAt: null,
    lastBackfillVerifiedAt: null,
    lastSmokeVerifiedAt: null,
    lastRetirementReportPath: '/reports/it04-retirement.json',
  },
  updatedAt: '2026-05-02T00:00:00.000Z',
}

const blockedReadiness = {
  l1Code: 'IT07',
  currentState: 'domain-primary',
  targetState: 'legacy-off',
  allowed: false,
  gateStatus: 'FAIL',
  prerequisites: {
    cutoverTierPassed: true,
    observationWindowPassed: true,
    killSwitchDrillPassed: false,
    rollbackVerified: false,
    reclassifyReady: true,
    backfillReady: false,
  },
  blockingReasons: [
    'kill switch drill has not been verified',
    'rollback readiness has not been verified',
  ],
  metrics: {
    totalRuns: 18,
    fallbackCount: 1,
    unknownCount: 0,
    manualCorrectionCount: 0,
    fallbackRate: 0.0556,
    unknownRate: 0,
    manualCorrectionRate: 0,
    errorBudgetConsumed: 0.0556,
    observationWindowDays: 14,
  },
  rolloutGuidance: {
    canaryPercentage: 10,
    errorBudget: 0.06,
    rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
  },
  recommendedNextAction: 'Resolve blocking reasons before retiring IT07.',
  cleanupReadiness: {
    allowed: false,
    blockingReasons: ['physical cleanup requires a completed legacy-off retirement first'],
  },
  latestExecution: {
    lastRetirementReportPath: '/reports/it07-retirement.json',
  },
  policySummary: {
    l1Code: 'IT07',
    rolloutState: 'domain-primary',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'taxonomy-classifier-6.6',
    primaryThreshold: 0.78,
    shadowWindowDays: 14,
    stateChangedAt: '2026-05-01T00:00:00.000Z',
  },
}

const passingReadiness = {
  ...blockedReadiness,
  l1Code: 'IT04',
  allowed: true,
  gateStatus: 'PASS',
  blockingReasons: [],
  recommendedNextAction: 'Execute legacy-off for IT04.',
  prerequisites: {
    cutoverTierPassed: true,
    observationWindowPassed: true,
    killSwitchDrillPassed: true,
    rollbackVerified: true,
    reclassifyReady: true,
    backfillReady: true,
  },
  policySummary: {
    l1Code: 'IT04',
    rolloutState: 'domain-primary',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'taxonomy-classifier-6.6',
    primaryThreshold: 0.7,
    shadowWindowDays: 14,
    stateChangedAt: '2026-05-01T00:00:00.000Z',
  },
}

const executionResult = {
  l1Code: 'IT04',
  previousState: 'domain-primary',
  targetState: 'legacy-off',
  stateChangedAt: '2026-05-03T08:20:00.000Z',
  operator: 'admin-1',
  smokeVerification: {
    passed: true,
    checkedAt: '2026-05-03T08:21:00.000Z',
  },
  reportPath: '/reports/taxonomy-retirement/IT04-rel-8-3-001.json',
  finalFallbackRate: 0.0087,
  cleanupReadiness: {
    allowed: false,
    blockingReasons: ['first non-IT04 cleanup requires a separate release'],
  },
  rollbackReadiness: {
    verified: true,
    path: 'Enable kill switch and revert rollout state to domain-primary',
  },
  auditSummary: {
    updatedBy: 'admin-1',
    releaseId: 'rel-8-3-001',
    rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
  },
  policySummary: {
    ...passingReadiness.policySummary,
    rolloutState: 'legacy-off',
    allowLegacyFallback: false,
  },
}

const rollbackResult = {
  l1Code: 'IT04',
  previousState: 'legacy-off',
  targetState: 'domain-primary',
  stateChangedAt: '2026-05-03T08:30:00.000Z',
  operator: 'admin-1',
  legacyFallbackRestored: true,
  rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
  reportPath: '/reports/taxonomy-retirement/IT04-rel-8-3-001.json',
  evidenceSummary: {
    lastRollbackVerifiedAt: '2026-05-03T08:30:00.000Z',
    lastRetirementReportPath: '/reports/taxonomy-retirement/IT04-rel-8-3-001.json',
  },
  auditSummary: {
    updatedBy: 'admin-1',
    rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
  },
  policySummary: {
    ...passingReadiness.policySummary,
    rolloutState: 'domain-primary',
    allowLegacyFallback: true,
  },
}

async function renderPage() {
  const modulePath = './page' as string
  const pageModule = await import(modulePath)
  render(React.createElement(pageModule.default))
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

describe('TaxonomyRolloutRetirementPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'l1Code') return 'IT04'
      return null
    })
    mockFetchRolloutPolicies.mockResolvedValue(listPolicies)
    mockFetchRolloutPolicyByL1Code.mockResolvedValue(detailPolicy)
    mockEvaluateRetirementDryRun.mockResolvedValue(passingReadiness)
    mockExecuteTaxonomyRetirement.mockResolvedValue(executionResult)
    mockRollbackTaxonomyRetirement.mockResolvedValue(rollbackResult)
  })

  test('[8.3-RTL-001][P0] preselects l1Code from query params and renders blocked readiness with disabled Execute CTA', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'l1Code') return 'IT07'
      return null
    })
    mockFetchRolloutPolicyByL1Code.mockResolvedValue({ ...detailPolicy, ...listPolicies[1] })
    mockEvaluateRetirementDryRun.mockResolvedValue(blockedReadiness)

    await renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Taxonomy Rollout Retirement Console' })
      ).toBeInTheDocument()
    })

    const selects = screen.getAllByLabelText('mock-select') as HTMLSelectElement[]
    expect(selects[0].value).toBe('IT07')

    fireEvent.click(screen.getByRole('button', { name: 'Run Retirement Dry Run' }))

    await waitFor(() => {
      expect(mockEvaluateRetirementDryRun).toHaveBeenCalledWith({ l1Code: 'IT07' })
    })

    expect(screen.getByText('Rollback Verified')).toBeVisible()
    expect(screen.getByText('Backfill Ready')).toBeVisible()
    expect(screen.getByText('kill switch drill has not been verified')).toBeVisible()
    expect(screen.getByText('rollback readiness has not been verified')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Execute Legacy-Off' })).toBeDisabled()
  })

  test('[8.3-RTL-006][P0] ignores stale dry-run results after the selected domain changes', async () => {
    const pendingDryRun = deferred<typeof passingReadiness>()
    mockEvaluateRetirementDryRun.mockImplementationOnce(() => pendingDryRun.promise)

    await renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Taxonomy Rollout Retirement Console' })
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Run Retirement Dry Run' }))
    await waitFor(() => {
      expect(mockEvaluateRetirementDryRun).toHaveBeenCalledWith({ l1Code: 'IT04' })
    })

    const select = screen.getByLabelText('mock-select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'IT07' } })
    await waitFor(() => {
      expect(select.value).toBe('IT07')
    })

    pendingDryRun.resolve(passingReadiness)

    await waitFor(() => {
      expect(screen.queryByText('Execute legacy-off for IT04.')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Execute Legacy-Off' })).toBeDisabled()
  })

  test('[8.3-RTL-002][P0] opens Confirm Legacy-Off dialog and renders execution summary after success', async () => {
    mockFetchRolloutPolicies
      .mockResolvedValueOnce(listPolicies)
      .mockResolvedValueOnce([
        { ...listPolicies[0], rolloutState: 'legacy-off', allowLegacyFallback: false },
        listPolicies[1],
      ])
    mockFetchRolloutPolicyByL1Code.mockResolvedValueOnce(detailPolicy).mockResolvedValueOnce({
      ...detailPolicy,
      rolloutState: 'legacy-off',
      allowLegacyFallback: false,
    })

    await renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Taxonomy Rollout Retirement Console' })
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Run Retirement Dry Run' }))
    await screen.findByText('Execute legacy-off for IT04.')
    fireEvent.click(screen.getByRole('button', { name: 'Execute Legacy-Off' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Confirm Legacy-Off')).toBeVisible()

    fireEvent.change(within(dialog).getByLabelText('Release ID'), {
      target: { value: ' rel-8-3-001 ' },
    })
    fireEvent.change(within(dialog).getByLabelText('Type Domain Code to Confirm'), {
      target: { value: 'IT04' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Execute Legacy-Off' }))

    await waitFor(() => {
      expect(mockExecuteTaxonomyRetirement).toHaveBeenCalledWith({
        l1Code: 'IT04',
        releaseId: 'rel-8-3-001',
        confirmationText: 'IT04',
      })
    })

    expect(screen.getByText('Retirement completed')).toBeVisible()
    expect(screen.getByText('Smoke Verification: PASS')).toBeVisible()
    expect(screen.queryByText('Execute legacy-off for IT04.')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: '/reports/taxonomy-retirement/IT04-rel-8-3-001.json',
      })
    ).toHaveAttribute(
      'href',
      '/api/admin/knowledge-graph/taxonomy-rollout/retirement/report?path=%2Freports%2Ftaxonomy-retirement%2FIT04-rel-8-3-001.json'
    )
  })

  test('[8.3-RTL-003][P0] opens Confirm Rollback dialog and renders restored state summary after success', async () => {
    mockFetchRolloutPolicies.mockResolvedValue([
      { ...listPolicies[0], rolloutState: 'legacy-off', allowLegacyFallback: false },
      listPolicies[1],
    ])
    mockFetchRolloutPolicyByL1Code
      .mockResolvedValueOnce({
        ...detailPolicy,
        rolloutState: 'legacy-off',
        allowLegacyFallback: false,
      })
      .mockResolvedValueOnce(detailPolicy)

    await renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Taxonomy Rollout Retirement Console' })
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Rollback' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Confirm Rollback' })).toBeVisible()
    fireEvent.change(within(dialog).getByLabelText('Type Domain Code to Confirm'), {
      target: { value: 'IT04' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Rollback' }))

    await waitFor(() => {
      expect(mockRollbackTaxonomyRetirement).toHaveBeenCalledWith({
        l1Code: 'IT04',
        targetState: 'domain-primary',
        confirmationText: 'IT04',
        restoreLegacyFallback: true,
      })
    })

    expect(screen.getByText('Rollback completed')).toBeVisible()
    expect(screen.getByText('Legacy Fallback: Restored')).toBeVisible()
    expect(screen.getByText('Restored State: domain-primary')).toBeVisible()
  })

  test('[8.3-RTL-007][P1] rejects unsafe releaseId in the execute dialog before calling the API', async () => {
    await renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Taxonomy Rollout Retirement Console' })
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Run Retirement Dry Run' }))
    await screen.findByText('Execute legacy-off for IT04.')
    fireEvent.click(screen.getByRole('button', { name: 'Execute Legacy-Off' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Release ID'), {
      target: { value: 'rel 8 3 001' },
    })
    fireEvent.change(within(dialog).getByLabelText('Type Domain Code to Confirm'), {
      target: { value: 'IT04' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Execute Legacy-Off' }))

    expect(mockExecuteTaxonomyRetirement).not.toHaveBeenCalled()
    expect(
      within(dialog).getByText(
        'releaseId must be 1-80 characters and contain only letters, numbers, dots, underscores, or hyphens.'
      )
    ).toBeVisible()
  })

  test('[8.3-RTL-005][P1] keeps execute failures visible inside the active confirmation dialog', async () => {
    mockExecuteTaxonomyRetirement.mockRejectedValueOnce(
      new Error('Retirement blocked: rollback readiness has not been verified')
    )

    await renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Taxonomy Rollout Retirement Console' })
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Run Retirement Dry Run' }))
    await screen.findByText('Execute legacy-off for IT04.')
    fireEvent.click(screen.getByRole('button', { name: 'Execute Legacy-Off' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Release ID'), {
      target: { value: 'rel-8-3-001' },
    })
    fireEvent.change(within(dialog).getByLabelText('Type Domain Code to Confirm'), {
      target: { value: 'IT04' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Execute Legacy-Off' }))

    await waitFor(() => {
      expect(mockExecuteTaxonomyRetirement).toHaveBeenCalledWith({
        l1Code: 'IT04',
        releaseId: 'rel-8-3-001',
        confirmationText: 'IT04',
      })
    })

    expect(
      within(screen.getByRole('dialog')).getByText(
        'Retirement blocked: rollback readiness has not been verified'
      )
    ).toBeVisible()
    expect(
      screen.getAllByText('Retirement blocked: rollback readiness has not been verified')
    ).toHaveLength(1)
  })

  test('[8.3-RTL-004][P1] renders non-admin denial state', async () => {
    mockUseSession.mockReturnValueOnce({
      data: { user: { id: 'consultant-1', role: 'consultant', name: 'Consultant' } },
      status: 'authenticated',
    })

    await renderPage()

    expect(screen.getByText('无权访问 Taxonomy Rollout Retirement Console')).toBeVisible()
    expect(screen.queryByRole('button', { name: '返回管理后台' })).not.toBeInTheDocument()
  })
})
