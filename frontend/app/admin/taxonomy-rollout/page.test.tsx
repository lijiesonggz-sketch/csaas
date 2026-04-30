import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import TaxonomyRolloutPage from './page'
import * as rolloutApi from '@/lib/api/taxonomy-rollout'

const mockPush = jest.fn()
const mockUseSession = jest.fn(() => ({
  data: { user: { id: 'admin-1', role: 'admin' } },
  status: 'authenticated',
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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

jest.mock('@/lib/api/taxonomy-rollout')

const mockFetchRolloutPolicies = rolloutApi.fetchRolloutPolicies as jest.MockedFunction<
  typeof rolloutApi.fetchRolloutPolicies
>
const mockFetchRolloutPolicyByL1Code = rolloutApi.fetchRolloutPolicyByL1Code as jest.MockedFunction<
  typeof rolloutApi.fetchRolloutPolicyByL1Code
>

const listPolicies: rolloutApi.TaxonomyRolloutPolicyListItem[] = [
  {
    id: 'p1',
    l1Code: 'IT01',
    rolloutState: 'legacy-primary',
    allowLegacyFallback: false,
    killSwitchEnabled: false,
    activeClassifierVersion: 'v2.0',
    primaryThreshold: 0.72,
    shadowWindowDays: 21,
    stateChangedAt: '2026-01-09T00:00:00.000Z',
    stateAllowsPrimary: true,
    stateAllowsLegacyFallback: false,
    hasRetirementEvidence: false,
  },
  {
    id: 'p4',
    l1Code: 'IT04',
    rolloutState: 'it04-on-new-interface',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'v2.0',
    primaryThreshold: 0.7,
    shadowWindowDays: 14,
    stateChangedAt: '2026-01-10T00:00:00.000Z',
    stateAllowsPrimary: true,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: true,
  },
]

const detailPolicy: rolloutApi.TaxonomyRolloutPolicyDetail = {
  ...listPolicies[1],
  mappingOwner: 'team-alpha',
  rulebookOwner: 'team-beta',
  benchmarkOwner: 'team-gamma',
  gateApprover: 'lead-1',
  rollbackApprover: 'lead-2',
  cutoverThresholdsJson: { canaryPercentage: 10, errorBudget: 0.02 },
  retirementThresholdsJson: { fallbackRateMax: 0.05 },
  retirementEvidenceJson: {
    lastCutoverAt: '2026-01-10T00:00:00.000Z',
    lastCutoverReleaseId: 'rel-001',
    lastLegacyOffAt: null,
    lastLegacyOffReleaseId: null,
    lastKillSwitchDrillAt: '2026-01-11T00:00:00.000Z',
    lastRollbackVerifiedAt: null,
    lastReclassifyVerifiedAt: null,
    lastBackfillVerifiedAt: null,
    lastSmokeVerifiedAt: null,
    lastRetirementReportPath: '/reports/it04-retirement.json',
  },
  updatedAt: '2026-01-15T00:00:00.000Z',
}

describe('TaxonomyRolloutPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchRolloutPolicies.mockResolvedValue(listPolicies)
    mockFetchRolloutPolicyByL1Code.mockResolvedValue(detailPolicy)
  })

  test('[8.1-RTL-001][P0] renders AC#1 columns and uses backend readiness flags for summary counts', async () => {
    render(<TaxonomyRolloutPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Taxonomy Rollout Overview' })).toBeInTheDocument()
    })

    expect(screen.getByText('Shadow Window')).toBeInTheDocument()
    expect(screen.getByText('State Changed')).toBeInTheDocument()
    expect(screen.getByText('21d')).toBeInTheDocument()
    expect(screen.getByText('2026-01-10')).toBeInTheDocument()
    expect(screen.getByTestId('readiness-ready-count')).toHaveTextContent('2')
    expect(screen.getByTestId('readiness-not-ready-count')).toHaveTextContent('0')
  })

  test('[8.1-RTL-002][P1] renders structured retirement evidence in the detail panel', async () => {
    render(<TaxonomyRolloutPage />)

    await waitFor(() => {
      expect(screen.getByText('IT04')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('IT04'))

    await waitFor(() => {
      expect(mockFetchRolloutPolicyByL1Code).toHaveBeenCalledWith('IT04')
    })

    expect(screen.getByText('Retirement Evidence')).toBeInTheDocument()
    expect(screen.getByText('Last Cutover Release ID')).toBeInTheDocument()
    expect(screen.getByText('rel-001')).toBeInTheDocument()
    expect(screen.getByText('/reports/it04-retirement.json')).toBeInTheDocument()
    expect(screen.getAllByText('2026-01-10').length).toBeGreaterThan(0)
  })

  test('[8.1-RTL-003][P1] clears the stale detail panel when filters exclude the selected domain', async () => {
    render(<TaxonomyRolloutPage />)

    await waitFor(() => {
      expect(screen.getByText('IT04')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('IT04'))

    await waitFor(() => {
      expect(screen.getByText('IT04 详情')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('搜索 domain code...'), {
      target: { value: 'IT01' },
    })

    await waitFor(() => {
      expect(screen.getByText('选择 Domain 查看详情')).toBeInTheDocument()
    })
  })
})
