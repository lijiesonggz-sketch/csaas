import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import OrganizationProfilePage from '../page'
import {
  OrganizationProfileRequestError,
  organizationsApi,
} from '@/lib/api/organizations'

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

/* eslint-disable @typescript-eslint/no-explicit-any */
// Mock shadcn/ui Select: make Select render a real <select>, flatten children into it
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

const toastSuccess = jest.fn()
const toastError = jest.fn()

jest.mock('sonner', () => ({
  toast: {
    success: (...args) => toastSuccess(...args),
    error: (...args) => toastError(...args),
  },
}))

jest.mock('@/lib/api/organizations', () => ({
  organizationsApi: {
    getOrganizationProfile: jest.fn(),
    upsertOrganizationProfile: jest.fn(),
  },
  OrganizationProfileRequestError: class OrganizationProfileRequestError extends Error {
    code
    status

    constructor(message, code, status) {
      super(message)
      this.name = 'OrganizationProfileRequestError'
      this.code = code
      this.status = status
    }
  },
}))

const mockUseSession = useSession as jest.Mock
const mockUseParams = useParams as jest.Mock
const mockUseRouter = useRouter as jest.Mock

const completeProfile = {
  orgId: 'org-1',
  industry: 'bank',
  legalPersonType: 'legal_person',
  assetBucket: 'large',
  hasPersonalInfo: true,
  crossBorderData: false,
  importantDataStatus: 'unknown',
  ciioStatus: 'no',
  hasDatacenter: true,
  usesCloud: true,
  outsourcingLevel: 'medium',
  criticalSystemLevel: 'high',
  hasOnlineTrading: false,
  hasAiServices: false,
  publicServiceScope: 'public_users',
  regulatoryAttentionLevel: 'medium',
  recentMajorIncident: false,
  updatedAt: '2026-03-26T10:00:00.000Z',
}

function renderPage() {
  return render(<OrganizationProfilePage />)
}

function getSelectElement(label) {
  // Find label text, then get the <select> from the same parent container
  const labelEl = screen.getByText(label)
  const container = labelEl.closest('.space-y-2') || labelEl.parentElement
  if (container) {
    const select = container.querySelector('select')
    if (select) return select
  }
  // Fallback: look by associated htmlFor/id
  const htmlFor = labelEl.getAttribute('for') || labelEl.getAttribute('htmlfor')
  if (htmlFor) {
    const trigger = document.getElementById(htmlFor)
    if (trigger) {
      const select = trigger.parentElement?.querySelector('select') || trigger.closest('div')?.querySelector('select')
      if (select) return select
    }
  }
  throw new Error(`Select element not found for label: ${label}`)
}

async function selectOption(label, optionText) {
  const selectEl = getSelectElement(label)
  fireEvent.change(selectEl, { target: { value: optionText } })
}

async function fillValidForm() {
  await selectOption('所属行业', 'bank')
  await selectOption('法人主体类型', 'legal_person')
  await selectOption('资产规模档位', 'large')
  await selectOption('监管关注等级', 'medium')
  await selectOption('是否涉及个人信息', 'true')
  await selectOption('是否跨境处理数据', 'false')
  await selectOption('重要数据识别情况', 'unknown')
  await selectOption('关键信息基础设施认定情况', 'no')
  await selectOption('是否自建机房', 'true')
  await selectOption('是否使用云服务', 'true')
  await selectOption('外包依赖程度', 'medium')
  await selectOption('关键系统等级', 'high')
  await selectOption('是否有线上交易', 'false')
  await selectOption('是否提供AI服务', 'false')
  await selectOption('公共服务范围', 'public_users')
  await selectOption('近一年是否发生重大事件', 'false')
}

describe('OrganizationProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ orgId: 'org-1' })
    mockUseRouter.mockReturnValue({ back: jest.fn() })
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          organizationId: 'org-1',
          role: 'consultant',
          organizationRole: 'admin',
        },
      },
      status: 'authenticated',
    })
  })

  it('loads an existing organization profile and shows the 16 required fields', async () => {
    organizationsApi.getOrganizationProfile.mockResolvedValue(completeProfile)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('机构画像配置')).toBeInTheDocument()
    })

    const industrySelect = getSelectElement('所属行业')
    expect(industrySelect.value).toBe('bank')
    expect(getSelectElement('法人主体类型').value).toBe('legal_person')
    expect(getSelectElement('资产规模档位').value).toBe('large')
    expect(getSelectElement('是否涉及个人信息').value).toBe('true')
    expect(getSelectElement('是否跨境处理数据').value).toBe('false')
    expect(getSelectElement('重要数据识别情况').value).toBe('unknown')
    expect(getSelectElement('关键信息基础设施认定情况').value).toBe('no')
    expect(getSelectElement('是否自建机房').value).toBe('true')
    expect(getSelectElement('是否使用云服务').value).toBe('true')
    expect(getSelectElement('外包依赖程度').value).toBe('medium')
    expect(getSelectElement('关键系统等级').value).toBe('high')
    expect(getSelectElement('是否有线上交易').value).toBe('false')
    expect(getSelectElement('是否提供AI服务').value).toBe('false')
    expect(getSelectElement('公共服务范围').value).toBe('public_users')
    expect(getSelectElement('监管关注等级').value).toBe('medium')
    expect(getSelectElement('近一年是否发生重大事件').value).toBe('false')
    expect(screen.getByText(/最近保存：/)).toBeInTheDocument()
  })

  it('treats backend 404 as first-time configuration and renders a blank editable form', async () => {
    organizationsApi.getOrganizationProfile.mockRejectedValue(
      new OrganizationProfileRequestError('机构画像不存在', 'not_found', 404),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/首次配置机构画像/)).toBeInTheDocument()
    })

    expect(getSelectElement('所属行业').value).toBe('')
    expect(screen.getByRole('button', { name: '保存画像' })).toBeInTheDocument()
  })

  it('blocks save when required fields are missing and highlights the invalid fields', async () => {
    organizationsApi.getOrganizationProfile.mockRejectedValue(
      new OrganizationProfileRequestError('机构画像不存在', 'not_found', 404),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存画像' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '保存画像' }))

    expect((await screen.findAllByText('请选择所属行业')).length).toBeGreaterThanOrEqual(1)
    expect(organizationsApi.upsertOrganizationProfile).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('请先补全机构画像的必填字段。')
  })

  it('persists the profile through organizationsApi and surfaces updatedAt after save', async () => {
    organizationsApi.getOrganizationProfile.mockRejectedValue(
      new OrganizationProfileRequestError('机构画像不存在', 'not_found', 404),
    )
    organizationsApi.upsertOrganizationProfile.mockResolvedValue({
      ...completeProfile,
      updatedAt: '2026-03-26T11:00:00.000Z',
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存画像' })).toBeInTheDocument()
    })

    await fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: '保存画像' }))

    await waitFor(() => {
      expect(organizationsApi.upsertOrganizationProfile).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          industry: 'bank',
          legalPersonType: 'legal_person',
          assetBucket: 'large',
          hasPersonalInfo: true,
          recentMajorIncident: false,
        }),
      )
    })

    expect(await screen.findByText('机构画像已保存。')).toBeInTheDocument()
    expect(screen.getByText(/最近保存：/)).toBeInTheDocument()
    expect(toastSuccess).toHaveBeenCalledWith('机构画像已保存。')
  })

  it('renders a non-empty error state with retry when profile loading fails', async () => {
    organizationsApi.getOrganizationProfile.mockRejectedValueOnce(
      new Error('网络超时'),
    )
    organizationsApi.getOrganizationProfile.mockResolvedValueOnce(completeProfile)

    renderPage()

    expect(await screen.findByText('网络超时')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    await waitFor(() => {
      expect(organizationsApi.getOrganizationProfile).toHaveBeenCalledTimes(2)
    })

    expect(await screen.findByText(/最近保存：/)).toBeInTheDocument()
  })

  it('shows a conflict message instead of silently overwriting when save returns 409', async () => {
    organizationsApi.getOrganizationProfile.mockResolvedValue(completeProfile)
    organizationsApi.upsertOrganizationProfile.mockRejectedValue(
      new OrganizationProfileRequestError(
        '机构画像已被其他用户更新，请刷新后重试',
        'conflict',
        409,
      ),
    )

    renderPage()

    await waitFor(() => {
      expect(getSelectElement('所属行业').value).toBe('bank')
    })

    await selectOption('所属行业', 'insurance')
    fireEvent.click(screen.getByRole('button', { name: '保存画像' }))

    expect(
      await screen.findByText('机构画像已被其他用户更新，请刷新后重新编辑。'),
    ).toBeInTheDocument()
  })

  it('renders client_pm users in read-only mode', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          organizationId: 'org-1',
          role: 'client_pm',
          organizationRole: 'admin',
        },
      },
      status: 'authenticated',
    })
    organizationsApi.getOrganizationProfile.mockResolvedValue(completeProfile)

    renderPage()

    expect(
      await screen.findByText('当前账号仅可查看机构画像，不能修改。'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存画像' })).not.toBeInTheDocument()
    // The mocked select has aria-disabled when disabled
    const industrySelect = getSelectElement('所属行业')
    expect(industrySelect.disabled).toBe(true)
  })
})
