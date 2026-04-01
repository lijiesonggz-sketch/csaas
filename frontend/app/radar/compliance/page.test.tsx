import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ComplianceRadarPage from './page'
import { getCompliancePushes, normalizeRadarPush } from '@/lib/api/radar'
import { useWebSocket } from '@/lib/hooks/useWebSocket'

const mockControlDetailDrawer = jest.fn((props: {
  open: boolean
  controlId: string
  organizationId: string
  sourceModule: string
  sourceRecordId?: string
}) =>
  props.open ? (
    <div
      data-testid="control-detail-drawer-probe"
      data-control-id={props.controlId}
      data-organization-id={props.organizationId}
      data-source-module={props.sourceModule}
      data-source-record-id={props.sourceRecordId}
    />
  ) : null,
)

jest.mock('@/lib/api/radar')
jest.mock('@/lib/hooks/useWebSocket')
jest.mock('@/components/compliance/ControlDetailDrawer', () => ({
  ControlDetailDrawer: (props: {
    open: boolean
    controlId: string
    organizationId: string
    sourceModule: string
    sourceRecordId?: string
  }) => mockControlDetailDrawer(props),
}))

jest.mock('@/lib/stores/useOrganizationStore', () => {
  const mockStore = {
    currentOrganization: { id: 'org-1', name: '测试银行' },
    organizations: [{ id: 'org-1', name: '测试银行' }],
    fetchOrganizations: jest.fn().mockResolvedValue(undefined),
  }

  const useOrganizationStore = jest.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockStore)
    }
    return mockStore
  })

  useOrganizationStore.getState = jest.fn().mockReturnValue(mockStore)

  return {
    useOrganizationStore,
    __esModule: true,
  }
})

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

describe('ComplianceRadarPage', () => {
  const renderWithProviders = () => render(<ComplianceRadarPage />)

  const radarContext = (pushId: string) => ({
    controlId: null,
    matchedControls: [],
    sourceModule: 'radar' as const,
    sourceRecordId: pushId,
    sourceRoute: '/radar/compliance',
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(normalizeRadarPush as jest.Mock).mockImplementation((push) => push)
    ;(getCompliancePushes as jest.Mock).mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })
    ;(useWebSocket as jest.Mock).mockReturnValue({
      socket: { on: jest.fn(), off: jest.fn() },
      isConnected: false,
    })
  })

  it('renders current header and action buttons', async () => {
    renderWithProviders()

    expect(await screen.findByText('合规雷达 - 风险预警与应对剧本')).toBeInTheDocument()
    expect(screen.getByText('返回雷达')).toBeInTheDocument()
    expect(screen.getByText('刷新')).toBeInTheDocument()
  })

  it('shows the current empty state', async () => {
    renderWithProviders()

    expect(await screen.findByText('暂无合规雷达推送')).toBeInTheDocument()
  })

  it('shows connection status text without relying on legacy MUI markup', async () => {
    ;(useWebSocket as jest.Mock).mockReturnValue({
      socket: { on: jest.fn(), off: jest.fn() },
      isConnected: true,
    })

    renderWithProviders()

    expect(await screen.findByText('实时推送已连接')).toBeInTheDocument()
  })

  it('renders a push card when API data is available', async () => {
    ;(getCompliancePushes as jest.Mock).mockResolvedValue({
      data: [
        {
          ...radarContext('push-1'),
          pushId: 'push-1',
          radarType: 'compliance',
          title: '测试推送',
          summary: '测试摘要',
          relevanceScore: 0.93,
          priorityLevel: 1,
          weaknessCategories: [],
          url: 'https://example.com',
          publishDate: '2026-03-28',
          source: '测试来源',
          tags: [],
          targetAudience: 'test',
          isRead: false,
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })

    renderWithProviders()

    expect(await screen.findByText('测试推送')).toBeInTheDocument()
    expect(screen.getByText(/共 1 条推送/)).toBeInTheDocument()
  })

  it('passes the shared radar context into ControlDetailDrawer when a control button is clicked', async () => {
    ;(getCompliancePushes as jest.Mock).mockResolvedValue({
      data: [
        {
          ...radarContext('push-ctx-1'),
          pushId: 'push-ctx-1',
          radarType: 'compliance',
          title: '带控制点上下文的推送',
          summary: '测试摘要',
          relevanceScore: 0.93,
          priorityLevel: 1,
          weaknessCategories: [],
          url: 'https://example.com',
          publishDate: '2026-03-28',
          source: '测试来源',
          tags: [],
          targetAudience: 'test',
          isRead: false,
          controlId: 'ctrl-001',
          matchedControls: [
            {
              controlId: 'ctrl-001',
              controlName: '测试控制点',
              packSource: '测试包',
              priority: 'high',
            },
          ],
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })

    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByText('带控制点上下文的推送')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '查看控制点详情' }))

    const drawerProbe = await screen.findByTestId('control-detail-drawer-probe')
    expect(drawerProbe).toHaveAttribute('data-control-id', 'ctrl-001')
    expect(drawerProbe).toHaveAttribute('data-organization-id', 'org-1')
    expect(drawerProbe).toHaveAttribute('data-source-module', 'radar')
    expect(drawerProbe).toHaveAttribute('data-source-record-id', 'push-ctx-1')
  })
})
