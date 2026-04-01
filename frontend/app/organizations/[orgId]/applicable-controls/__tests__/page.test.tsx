import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useParams } from 'next/navigation'
import ApplicableControlsPage from '../page'
import { organizationsApi } from '@/lib/api/organizations'
import { resolveControls } from '@/lib/api/applicability-engine'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}))

jest.mock('@/components/organizations/ProfileCompletenessGate', () => ({
  ProfileCompletenessGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/lib/api/organizations', () => ({
  organizationsApi: {
    getOrganizationProfile: jest.fn(),
  },
}))

jest.mock('@/lib/api/applicability-engine', () => ({
  resolveControls: jest.fn(),
}))

/* eslint-disable @typescript-eslint/no-explicit-any */
// Mock shadcn/ui Select to use native <select> for JSDOM compatibility
jest.mock('@/components/ui/select', () => {
  const React = require('react')

  const collectOptions = (children) => {
    const options = []
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return
      if (child.type === SelectItem) {
        options.push(child)
      } else if (child.props?.children) {
        options.push(...collectOptions(child.props.children))
      }
    })
    return options
  }

  const Select = ({ children, value, onValueChange, disabled }) => {
    const options = collectOptions(children)
    return (
      <select
        value={value || ''}
        disabled={disabled || false}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {options}
      </select>
    )
  }

  const SelectContent = ({ children }) => <>{children}</>
  const SelectItem = ({ children, value }) => <option value={value}>{children}</option>

  const SelectTrigger = React.forwardRef(({ children, id, className, ...rest }, ref) => (
    <div
      id={id}
      className={className}
      ref={ref}
      aria-label={id}
      data-testid={id}
      {...rest}
    >
      {children}
    </div>
  ))

  const SelectValue = ({ placeholder }) => (
    <span>{placeholder || ''}</span>
  )

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

const mockUseParams = useParams as jest.Mock

describe('ApplicableControlsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ orgId: 'org-1' })
  })

  async function selectFilter(label: string, optionText: string) {
    // With mocked Select, find the <select> element via its Label
    const labelEl = screen.getByText(label)
    const container = labelEl.closest('.space-y-2') || labelEl.parentElement
    const select = container?.querySelector('select')
    if (!select) throw new Error(`Select not found for label: ${label}`)
    fireEvent.change(select, { target: { value: optionText } })
  }

  it('renders resolved controls and key explanation fields', async () => {
    ;(organizationsApi.getOrganizationProfile as jest.Mock).mockResolvedValue({
      updatedAt: '2026-03-26T10:00:00.000Z',
    })
    ;(resolveControls as jest.Mock).mockResolvedValue({
      organizationId: 'org-1',
      influencingProfileFields: ['industry', 'criticalSystemLevel'],
      matchedPacks: ['PACK-BASE-CYBER'],
      matchedRules: ['RULE-001'],
      controls: [
        {
          controlId: 'ctrl-1',
          controlCode: 'CP-001',
          controlName: '控制点一',
          controlFamily: '基础控制',
          mandatory: true,
          priority: 'HIGH',
          matchedPacks: ['PACK-BASE-CYBER'],
          matchedRules: ['RULE-001'],
          reasons: ['命中基础网络安全包'],
          questionPackCodes: [],
          evidencePackCodes: [],
          remediationPackCodes: [],
        },
      ],
      summary: {
        totalControls: 1,
        mandatoryCount: 1,
        matchedPacks: 1,
        matchedRules: 1,
        excludedControls: 0,
      },
      debugLog: [
        {
          ruleCode: 'RULE-001',
          targetType: 'control',
          targetCode: 'CP-001',
          ruleType: 'include',
          matched: true,
          traceEntries: [
            {
              field: 'industry',
              op: 'eq',
              actualValue: 'bank',
              matched: true,
              logicalPath: ['all'],
            },
          ],
          appliedEffect: {
            addedPackCodes: [],
            addedControlCodes: ['CP-001'],
            strengthenedControlCodes: [],
            excludedControlCodes: [],
          },
        },
      ],
    })

    render(<ApplicableControlsPage />)

    expect(await screen.findByText('CP-001 控制点一')).toBeInTheDocument()
    expect(screen.getByText(/关键画像字段：industry、criticalSystemLevel/)).toBeInTheDocument()
    expect(screen.getByText(/命中基础网络安全包/)).toBeInTheDocument()
    expect(resolveControls).toHaveBeenCalledWith({
      organizationId: 'org-1',
      scene: 'quick-gap-analysis',
    })
  })

  it('supports pack filtering', async () => {
    ;(organizationsApi.getOrganizationProfile as jest.Mock).mockResolvedValue({
      updatedAt: '2026-03-01T10:00:00.000Z',
    })
    ;(resolveControls as jest.Mock).mockResolvedValue({
      organizationId: 'org-1',
      influencingProfileFields: [],
      matchedPacks: ['PACK-A', 'PACK-B'],
      matchedRules: ['RULE-001'],
      controls: [
        {
          controlId: 'ctrl-1',
          controlCode: 'CP-001',
          controlName: '控制点一',
          controlFamily: '基础控制',
          mandatory: true,
          priority: 'HIGH',
          matchedPacks: ['PACK-A'],
          matchedRules: ['RULE-001'],
          reasons: ['A'],
          questionPackCodes: [],
          evidencePackCodes: [],
          remediationPackCodes: [],
        },
        {
          controlId: 'ctrl-2',
          controlCode: 'CP-002',
          controlName: '控制点二',
          controlFamily: '增强控制',
          mandatory: false,
          priority: 'LOW',
          matchedPacks: ['PACK-B'],
          matchedRules: ['RULE-001'],
          reasons: ['B'],
          questionPackCodes: [],
          evidencePackCodes: [],
          remediationPackCodes: [],
        },
      ],
      summary: {
        totalControls: 2,
        mandatoryCount: 1,
        matchedPacks: 2,
        matchedRules: 1,
        excludedControls: 0,
      },
      debugLog: [],
    })

    render(<ApplicableControlsPage />)

    expect(await screen.findByText('CP-001 控制点一')).toBeInTheDocument()
    await selectFilter('按控制包筛选', 'PACK-B')

    await waitFor(() => {
      expect(screen.queryByText('CP-001 控制点一')).not.toBeInTheDocument()
    })

    expect(screen.getByText('CP-002 控制点二')).toBeInTheDocument()
  })

  it('shows freshness warning and manual refresh when profile was recently updated', async () => {
    ;(organizationsApi.getOrganizationProfile as jest.Mock)
      .mockResolvedValueOnce({
        updatedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      })
    ;(resolveControls as jest.Mock)
      .mockResolvedValueOnce({
        organizationId: 'org-1',
        influencingProfileFields: [],
        matchedPacks: [],
        matchedRules: [],
        controls: [],
        summary: {
          totalControls: 0,
          mandatoryCount: 0,
          matchedPacks: 0,
          matchedRules: 0,
          excludedControls: 0,
        },
        debugLog: [],
      })
      .mockResolvedValueOnce({
        organizationId: 'org-1',
        influencingProfileFields: [],
        matchedPacks: [],
        matchedRules: [],
        controls: [],
        summary: {
          totalControls: 0,
          mandatoryCount: 0,
          matchedPacks: 0,
          matchedRules: 0,
          excludedControls: 0,
        },
        debugLog: [],
      })

    render(<ApplicableControlsPage />)

    expect(await screen.findByText(/画像刚更新，结果可能需要刷新/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '手动刷新' }))

    await waitFor(() => {
      expect(resolveControls).toHaveBeenCalledTimes(2)
    })
  })
})
