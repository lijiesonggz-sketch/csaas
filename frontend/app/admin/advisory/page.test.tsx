import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AdvisoryAdminPage from './page'
import { fetchAdvisoryModuleConfig, updateAdvisoryModuleConfig } from '@/lib/advisory/admin-config'

jest.mock('@/lib/advisory/admin-config', () => ({
  fetchAdvisoryModuleConfig: jest.fn(),
  updateAdvisoryModuleConfig: jest.fn(),
  THINKTANK_AUDIT_DELAY_MESSAGE: '审计摘要可能存在短暂延迟。',
  THINKTANK_PRIVACY_CONFIRMATION: '确认 ThinkTank 对话历史不会用于模型训练。',
  THINKTANK_ROLE_LABELS: {
    admin: '管理员',
    consultant: '主咨询师',
    client_pm: '企业PM',
    respondent: '被调研者',
  },
  THINKTANK_ROLE_ORDER: ['admin', 'consultant', 'client_pm', 'respondent'],
}))

const moduleConfig = {
  id: 'config-1',
  tenantId: 'tenant-1',
  moduleKey: 'thinktank',
  enabled: true,
  allowedRoles: ['admin', 'consultant', 'client_pm'],
  dataRetentionDays: 90,
  privacyConfirmedAt: '2026-05-19T00:00:00.000Z',
  privacyConfirmedBy: 'admin-1',
  latestAuditSummary: [
    {
      eventName: 'thinktank.module.enabled',
      actorUserId: 'admin-1',
      changedSetting: 'enabled',
      oldValue: false,
      newValue: true,
      occurredAt: '2026-05-19T00:00:00.000Z',
    },
  ],
}

describe('AdvisoryAdminPage', () => {
  const mockFetchConfig = fetchAdvisoryModuleConfig as jest.MockedFunction<
    typeof fetchAdvisoryModuleConfig
  >
  const mockUpdateConfig = updateAdvisoryModuleConfig as jest.MockedFunction<
    typeof updateAdvisoryModuleConfig
  >

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchConfig.mockResolvedValue(moduleConfig)
    mockUpdateConfig.mockResolvedValue(moduleConfig)
  })

  it('renders module status, role binding, retention, privacy confirmation, and audit summary', async () => {
    render(<AdvisoryAdminPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ThinkTank 配置' })).toBeInTheDocument()
    })

    expect(screen.getByRole('switch', { name: '启用 ThinkTank' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByText('90 天')).toBeInTheDocument()
    expect(screen.getByText('确认 ThinkTank 对话历史不会用于模型训练。')).toBeInTheDocument()
    expect(screen.getByLabelText('管理员')).toBeChecked()
    expect(screen.getByLabelText('主咨询师')).toBeChecked()
    expect(screen.getByLabelText('企业PM')).toBeChecked()
    expect(screen.getByLabelText('被调研者')).not.toBeChecked()
    expect(screen.getByText('thinktank.module.enabled')).toBeInTheDocument()
  })

  it('saves enabled state and role binding without sending tenant id', async () => {
    render(<AdvisoryAdminPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ThinkTank 配置' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('被调研者'))
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }))

    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        enabled: true,
        allowedRoles: ['admin', 'consultant', 'client_pm', 'respondent'],
        dataRetentionDays: 90,
        privacyConfirmed: true,
      })
    })

    expect(mockUpdateConfig.mock.calls[0][0]).not.toHaveProperty('tenantId')
  })

  it('requires confirmation before disabling ThinkTank', async () => {
    render(<AdvisoryAdminPage />)

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: '启用 ThinkTank' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('switch', { name: '启用 ThinkTank' }))

    expect(screen.getByRole('dialog', { name: '停用 ThinkTank' })).toBeInTheDocument()
    expect(screen.getByText('ThinkTank 当前未在本租户启用，请联系管理员开通。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '确认停用' }))

    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        })
      )
    })
  })

  it('shows an audit-delay fallback when latest audit summary is empty', async () => {
    mockFetchConfig.mockResolvedValue({
      ...moduleConfig,
      latestAuditSummary: [],
    })

    render(<AdvisoryAdminPage />)

    await waitFor(() => {
      expect(screen.getByText('审计摘要可能存在短暂延迟。')).toBeInTheDocument()
    })
  })
})
