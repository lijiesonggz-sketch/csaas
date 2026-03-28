import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const toastSuccess = jest.fn()
const toastError = jest.fn()

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

jest.mock('@/lib/api/organizations', () => ({
  organizationsApi: {
    getOrganizationProfile: jest.fn(),
    upsertOrganizationProfile: jest.fn(),
  },
  OrganizationProfileRequestError: class OrganizationProfileRequestError extends Error {
    code: string
    status?: number

    constructor(message: string, code: string, status?: number) {
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

function getSelectInput(label: string): HTMLInputElement {
  const trigger = screen.getByRole('combobox', { name: label })
  const input = trigger.parentElement?.querySelector('input')

  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Hidden input not found for select: ${label}`)
  }

  return input
}

async function selectOption(label: string, optionText: string) {
  const trigger = screen.getByRole('combobox', { name: label })
  fireEvent.mouseDown(trigger)
  fireEvent.click(await screen.findByRole('option', { name: optionText }))
}

async function fillValidForm() {
  await selectOption('所属行业', '银行')
  await selectOption('法人主体类型', '法人主体')
  await selectOption('资产规模档位', '大型')
  await selectOption('监管关注等级', '中')
  await selectOption('是否涉及个人信息', '是')
  await selectOption('是否跨境处理数据', '否')
  await selectOption('重要数据识别情况', '未识别')
  await selectOption('关键信息基础设施认定情况', '否')
  await selectOption('是否自建机房', '是')
  await selectOption('是否使用云服务', '是')
  await selectOption('外包依赖程度', '中')
  await selectOption('关键系统等级', '高')
  await selectOption('是否有线上交易', '否')
  await selectOption('是否提供AI服务', '否')
  await selectOption('公共服务范围', '公众用户')
  await selectOption('近一年是否发生重大事件', '否')
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

    expect(getSelectInput('所属行业')).toHaveValue('bank')
    expect(getSelectInput('法人主体类型')).toHaveValue('legal_person')
    expect(getSelectInput('资产规模档位')).toHaveValue('large')
    expect(getSelectInput('是否涉及个人信息')).toHaveValue('true')
    expect(getSelectInput('是否跨境处理数据')).toHaveValue('false')
    expect(getSelectInput('重要数据识别情况')).toHaveValue('unknown')
    expect(getSelectInput('关键信息基础设施认定情况')).toHaveValue('no')
    expect(getSelectInput('是否自建机房')).toHaveValue('true')
    expect(getSelectInput('是否使用云服务')).toHaveValue('true')
    expect(getSelectInput('外包依赖程度')).toHaveValue('medium')
    expect(getSelectInput('关键系统等级')).toHaveValue('high')
    expect(getSelectInput('是否有线上交易')).toHaveValue('false')
    expect(getSelectInput('是否提供AI服务')).toHaveValue('false')
    expect(getSelectInput('公共服务范围')).toHaveValue('public_users')
    expect(getSelectInput('监管关注等级')).toHaveValue('medium')
    expect(getSelectInput('近一年是否发生重大事件')).toHaveValue('false')
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

    expect(getSelectInput('所属行业')).toHaveValue('')
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

    expect((await screen.findAllByText('请选择所属行业')).length).toBeGreaterThan(1)
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
      expect(getSelectInput('所属行业')).toHaveValue('bank')
    })

    await selectOption('所属行业', '保险')
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
    expect(screen.getByRole('combobox', { name: '所属行业' })).toHaveAttribute('aria-disabled', 'true')
  })
})
