import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ProfileCompletenessGate } from './ProfileCompletenessGate'
import { organizationsApi } from '@/lib/api/organizations'

jest.mock('@/lib/api/organizations', () => ({
  organizationsApi: {
    getOrganizationProfileCompleteness: jest.fn(),
  },
}))

describe('ProfileCompletenessGate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('blocks access and shows missing fields when profile is incomplete', async () => {
    ;(organizationsApi.getOrganizationProfileCompleteness as jest.Mock).mockResolvedValue({
      organizationId: 'org-1',
      isComplete: false,
      validFieldCount: 14,
      totalRequiredFields: 16,
      completionRatio: '14/16',
      missingFields: [
        { field: 'ciioStatus', label: '关键信息基础设施认定情况', reason: 'missing' },
        { field: 'hasAiServices', label: '是否提供AI服务', reason: 'invalid' },
      ],
    })

    render(
      <ProfileCompletenessGate organizationId="org-1" flowLabel="适用控制点解析">
        <div>ALLOWED CONTENT</div>
      </ProfileCompletenessGate>,
    )

    expect(await screen.findByText(/当前机构画像未完成/)).toBeInTheDocument()
    expect(screen.getByText(/完成度：14\/16/)).toBeInTheDocument()
    expect(screen.getByText('关键信息基础设施认定情况')).toBeInTheDocument()
    expect(screen.getByText('是否提供AI服务（值非法）')).toBeInTheDocument()
    expect(screen.queryByText('ALLOWED CONTENT')).not.toBeInTheDocument()
  })

  it('renders children when profile is complete', async () => {
    ;(organizationsApi.getOrganizationProfileCompleteness as jest.Mock).mockResolvedValue({
      organizationId: 'org-1',
      isComplete: true,
      validFieldCount: 16,
      totalRequiredFields: 16,
      completionRatio: '16/16',
      missingFields: [],
    })

    render(
      <ProfileCompletenessGate organizationId="org-1">
        <div>ALLOWED CONTENT</div>
      </ProfileCompletenessGate>,
    )

    expect(await screen.findByText('ALLOWED CONTENT')).toBeInTheDocument()
  })

  it('shows an error state and retries when the completeness request fails', async () => {
    ;(organizationsApi.getOrganizationProfileCompleteness as jest.Mock)
      .mockRejectedValueOnce(new Error('网络超时'))
      .mockResolvedValueOnce({
        organizationId: 'org-1',
        isComplete: true,
        validFieldCount: 16,
        totalRequiredFields: 16,
        completionRatio: '16/16',
        missingFields: [],
      })

    render(
      <ProfileCompletenessGate organizationId="org-1">
        <div>ALLOWED CONTENT</div>
      </ProfileCompletenessGate>,
    )

    expect(await screen.findByText('网络超时')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    await waitFor(() => {
      expect(organizationsApi.getOrganizationProfileCompleteness).toHaveBeenCalledTimes(2)
    })

    expect(await screen.findByText('ALLOWED CONTENT')).toBeInTheDocument()
  })
})
