import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockPush = jest.fn()
const mockUseSession = jest.fn(() => ({
  data: { user: { id: 'admin-1', role: 'admin', name: 'Admin' } },
  status: 'authenticated',
}))
const mockSearchParams = {
  get: jest.fn(() => null),
}
const mockFetchRolloutPolicies = jest.fn()
const mockEvaluateRolloutGate = jest.fn()
const mockTransitionRolloutState = jest.fn()

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
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    children: React.ReactNode
    onOpenChange?: (value: boolean) => void
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog" aria-label="Confirm State Transition">
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/lib/api/taxonomy-rollout', () => ({
  fetchRolloutPolicies: (...args: unknown[]) => mockFetchRolloutPolicies(...args),
  evaluateRolloutGate: (...args: unknown[]) => mockEvaluateRolloutGate(...args),
  transitionRolloutState: (...args: unknown[]) => mockTransitionRolloutState(...args),
}))

const listPolicies = [
  {
    id: 'p4',
    l1Code: 'IT04',
    rolloutState: 'it04-on-new-interface',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'taxonomy-classifier-6.4',
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
    rolloutState: 'domain-compare',
    allowLegacyFallback: true,
    killSwitchEnabled: true,
    activeClassifierVersion: 'taxonomy-classifier-6.4',
    primaryThreshold: 0.78,
    shadowWindowDays: 14,
    stateChangedAt: '2026-05-01T00:00:00.000Z',
    stateAllowsPrimary: false,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: false,
  },
]

const blockedGateResult = {
  l1Code: 'IT07',
  currentState: 'domain-compare',
  targetState: 'domain-primary',
  allowed: false,
  gateStatus: 'FAIL',
  benchmarkGate: { gateStatus: 'FAIL' },
  metrics: {
    totalRuns: 42,
    fallbackRate: 0.0952,
    unknownRate: 0.0476,
    manualCorrectionRate: 0.0714,
    errorBudgetConsumed: 0.0952,
    observationWindowDays: 14,
  },
  blockingReasons: [
    'benchmark gate is not PASS for target domain',
    'runtime error budget exceeds cutover threshold',
  ],
  rolloutGuidance: {
    rollbackPath: 'Enable kill switch and revert rollout state',
  },
  recommendedNextAction: 'Investigate benchmark drift before promoting IT07 to domain-primary.',
  policySummary: {
    l1Code: 'IT07',
    rolloutState: 'domain-compare',
    killSwitchEnabled: true,
    allowLegacyFallback: true,
  },
}

const passingGateResult = {
  l1Code: 'IT04',
  currentState: 'it04-on-new-interface',
  targetState: 'domain-shadow',
  allowed: true,
  gateStatus: 'PASS',
  benchmarkGate: { gateStatus: 'PASS' },
  metrics: {
    totalRuns: 58,
    fallbackRate: 0.0172,
    unknownRate: 0,
    manualCorrectionRate: 0.0172,
    errorBudgetConsumed: 0.0172,
    observationWindowDays: 14,
  },
  blockingReasons: [],
  rolloutGuidance: {
    rollbackPath: 'Enable kill switch and revert rollout state',
  },
  recommendedNextAction: 'Promote IT04 to domain-shadow and keep monitoring fallback rate.',
  policySummary: {
    l1Code: 'IT04',
    rolloutState: 'it04-on-new-interface',
    killSwitchEnabled: false,
    allowLegacyFallback: true,
  },
}

const transitionResult = {
  l1Code: 'IT04',
  previousState: 'it04-on-new-interface',
  targetState: 'domain-shadow',
  stateChangedAt: '2026-05-02T04:28:37.000Z',
  operator: 'admin-1',
  auditSummary: {
    updatedBy: 'admin-1',
    rollbackPath: 'Enable kill switch and revert rollout state',
  },
  policySummary: {
    l1Code: 'IT04',
    rolloutState: 'domain-shadow',
    killSwitchEnabled: false,
    allowLegacyFallback: true,
  },
}

async function renderPage() {
  const modulePath = './page' as string
  const pageModule = await import(modulePath)
  render(React.createElement(pageModule.default))
}

describe('TaxonomyRolloutGatesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams.get.mockReturnValue(null)
    mockFetchRolloutPolicies.mockResolvedValue(listPolicies)
    mockEvaluateRolloutGate.mockResolvedValue(blockedGateResult)
    mockTransitionRolloutState.mockResolvedValue(transitionResult)
  })

  test('[8.2-RTL-001][P0] renders FAIL summary, metrics, blocking reasons, and read-only kill switch while keeping the disabled CTA visible', async () => {
    await renderPage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Taxonomy Rollout Gates' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getAllByLabelText('mock-select')[0], { target: { value: 'IT07' } })
    fireEvent.change(screen.getAllByLabelText('mock-select')[1], {
      target: { value: 'domain-primary' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate Readiness' }))

    await waitFor(() => {
      expect(mockEvaluateRolloutGate).toHaveBeenCalledWith({
        l1Code: 'IT07',
        targetState: 'domain-primary',
      })
    })

    expect(screen.getAllByText('FAIL').length).toBeGreaterThan(0)
    expect(screen.getByText('Kill Switch: Enabled (read-only)')).toBeVisible()
    expect(screen.getByText('benchmark gate is not PASS for target domain')).toBeVisible()
    expect(screen.getByText('runtime error budget exceeds cutover threshold')).toBeVisible()
    expect(screen.getByText('Enable kill switch and revert rollout state')).toBeVisible()
    expect(
      screen.getByText('Investigate benchmark drift before promoting IT07 to domain-primary.')
    ).toBeVisible()

    const disabledCta = screen.getByRole('button', { name: 'Promote to Primary' })
    expect(disabledCta).toBeVisible()
    expect(disabledCta).toBeDisabled()
  })

  test('[8.2-RTL-002][P0] enables the Promote CTA after PASS evaluation and shows a structured confirmation dialog', async () => {
    mockEvaluateRolloutGate.mockResolvedValueOnce(passingGateResult)

    await renderPage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Taxonomy Rollout Gates' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getAllByLabelText('mock-select')[0], { target: { value: 'IT04' } })
    fireEvent.change(screen.getAllByLabelText('mock-select')[1], {
      target: { value: 'domain-shadow' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate Readiness' }))

    await waitFor(() => {
      expect(mockEvaluateRolloutGate).toHaveBeenCalledWith({
        l1Code: 'IT04',
        targetState: 'domain-shadow',
      })
    })

    const promoteButton = screen.getByRole('button', { name: 'Promote to Shadow' })
    expect(promoteButton).toBeVisible()
    expect(promoteButton).toBeEnabled()

    fireEvent.click(promoteButton)

    const dialog = await screen.findByRole('dialog', { name: 'Confirm State Transition' })
    expect(within(dialog).getByText('IT04')).toBeVisible()
    expect(within(dialog).getByText('it04-on-new-interface')).toBeVisible()
    expect(within(dialog).getByText('domain-shadow')).toBeVisible()
    expect(within(dialog).getByText('14 days')).toBeVisible()
    expect(within(dialog).getByText('Enable kill switch and revert rollout state')).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Confirm Promote to Shadow' })).toBeVisible()
  })

  test('[8.2-RTL-003][P1] executes the confirmed PASS transition and refreshes the summary to the promoted state', async () => {
    mockEvaluateRolloutGate.mockResolvedValueOnce(passingGateResult).mockResolvedValueOnce({
      ...passingGateResult,
      currentState: 'domain-shadow',
      targetState: 'domain-compare',
      recommendedNextAction: 'Continue shadow observation before compare rollout.',
      policySummary: {
        l1Code: 'IT04',
        rolloutState: 'domain-shadow',
        killSwitchEnabled: false,
        allowLegacyFallback: true,
      },
    })
    mockFetchRolloutPolicies.mockResolvedValueOnce(listPolicies).mockResolvedValueOnce([
      {
        ...listPolicies[0],
        rolloutState: 'domain-shadow',
        stateChangedAt: '2026-05-02T04:28:37.000Z',
      },
      listPolicies[1],
    ])

    await renderPage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Taxonomy Rollout Gates' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getAllByLabelText('mock-select')[0], { target: { value: 'IT04' } })
    fireEvent.change(screen.getAllByLabelText('mock-select')[1], {
      target: { value: 'domain-shadow' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate Readiness' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Promote to Shadow' }))
    const dialog = await screen.findByRole('dialog', { name: 'Confirm State Transition' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Promote to Shadow' }))

    await waitFor(() => {
      expect(mockTransitionRolloutState).toHaveBeenCalledWith({
        l1Code: 'IT04',
        targetState: 'domain-shadow',
      })
    })

    await waitFor(() => {
      expect(mockEvaluateRolloutGate).toHaveBeenNthCalledWith(2, {
        l1Code: 'IT04',
        targetState: 'domain-compare',
      })
    })

    expect(screen.getByText('Transition completed')).toBeVisible()
    expect(screen.getByText('Continue shadow observation before compare rollout.')).toBeVisible()
    expect(screen.getAllByText(/domain-shadow/).length).toBeGreaterThan(0)
  })

  test('[8.2-RTL-004][P1] preselects l1Code and targetState from query params', async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'l1Code') return 'it07'
      if (key === 'targetState') return 'domain-primary'
      return null
    })

    await renderPage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Taxonomy Rollout Gates' })).toBeInTheDocument()
    })

    const selects = screen.getAllByLabelText('mock-select') as HTMLSelectElement[]
    expect(selects[0].value).toBe('IT07')
    expect(selects[1].value).toBe('domain-primary')
  })

  test('[8.2-RTL-005][P1] renders non-admin denial state', async () => {
    mockUseSession.mockReturnValueOnce({
      data: { user: { id: 'consultant-1', role: 'consultant', name: 'Consultant' } },
      status: 'authenticated',
    })

    await renderPage()

    expect(screen.getByText('无权访问 Taxonomy Rollout Gates')).toBeVisible()
    expect(screen.getByRole('button', { name: '返回管理后台' })).toBeVisible()
  })

  test('[8.2-RTL-006][P1] shows evaluate error message when gate evaluation request fails', async () => {
    mockEvaluateRolloutGate.mockRejectedValueOnce(new Error('gate evaluation unavailable'))

    await renderPage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Taxonomy Rollout Gates' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getAllByLabelText('mock-select')[0], { target: { value: 'IT07' } })
    fireEvent.change(screen.getAllByLabelText('mock-select')[1], {
      target: { value: 'domain-primary' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate Readiness' }))

    await waitFor(() => {
      expect(screen.getByText('gate evaluation unavailable')).toBeVisible()
    })
  })

  test('[8.2-RTL-007][P1] keeps the confirmation dialog open and shows transition error when mutation fails', async () => {
    mockEvaluateRolloutGate.mockResolvedValueOnce(passingGateResult)
    mockTransitionRolloutState.mockRejectedValueOnce(new Error('transition lock is active'))

    await renderPage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Taxonomy Rollout Gates' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getAllByLabelText('mock-select')[0], { target: { value: 'IT04' } })
    fireEvent.change(screen.getAllByLabelText('mock-select')[1], {
      target: { value: 'domain-shadow' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate Readiness' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Promote to Shadow' }))

    const dialog = await screen.findByRole('dialog', { name: 'Confirm State Transition' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Promote to Shadow' }))

    await waitFor(() => {
      expect(screen.getByText('transition lock is active')).toBeVisible()
    })
    expect(screen.getByRole('dialog', { name: 'Confirm State Transition' })).toBeVisible()
  })
})
