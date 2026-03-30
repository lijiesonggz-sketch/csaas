/**
 * Story 7.2: 雷达页面控制点详情抽屉集成测试
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ComplianceRadarPage from '../page'
import { getCompliancePushes } from '@/lib/api/radar'

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

// Mock dependencies
jest.mock('@/lib/api/radar', () => ({
  getCompliancePushes: jest.fn(),
}))
jest.mock('@/components/compliance/ControlDetailDrawer', () => ({
  ControlDetailDrawer: (props: {
    open: boolean
    controlId: string
    organizationId: string
    sourceModule: string
    sourceRecordId?: string
  }) => mockControlDetailDrawer(props),
}))

jest.mock('@/lib/hooks/useWebSocket', () => ({
  useWebSocket: jest.fn(() => ({
    socket: null,
    isConnected: false,
  })),
}))

jest.mock('@/lib/stores/useOrganizationStore', () => {
  const mockStore = {
    currentOrganization: { id: 'org-123', name: 'Test Org' },
    organizations: [{ id: 'org-123', name: 'Test Org' }],
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

describe('Story 7.2: Control Detail Drawer Integration', () => {
  const radarContext = (pushId: string) => ({
    controlId: null,
    matchedControls: [],
    sourceModule: 'radar' as const,
    sourceRecordId: pushId,
    sourceRoute: '/radar/compliance',
  })

  it('AC1: 应该在有 matchedControls 时显示控制点入口按钮', async () => {
    // Mock push with matchedControls
    ;(getCompliancePushes as jest.Mock).mockResolvedValue({
      data: [
        {
          ...radarContext('push-1'),
          pushId: 'push-1',
          radarType: 'compliance',
          title: '测试推送',
          summary: '测试摘要',
          relevanceScore: 0.95,
          priorityLevel: 3,
          weaknessCategories: [],
          url: 'https://example.com',
          publishDate: '2026-03-28',
          source: '测试来源',
          tags: [],
          targetAudience: 'test',
          isRead: false,
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
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    })

    render(<ComplianceRadarPage />)

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText('测试推送')).toBeInTheDocument()
    })

    // 验证控制点入口按钮存在
    expect(screen.getByText('查看控制点详情')).toBeInTheDocument()
  })

  it('AC1: 应该在没有 matchedControls 时隐藏控制点入口按钮', async () => {
    // Mock push without matchedControls
    ;(getCompliancePushes as jest.Mock).mockResolvedValue({
      data: [
        {
          ...radarContext('push-2'),
          pushId: 'push-2',
          radarType: 'compliance',
          title: '无控制点推送',
          summary: '测试摘要',
          relevanceScore: 0.85,
          priorityLevel: 2,
          weaknessCategories: [],
          url: 'https://example.com',
          publishDate: '2026-03-28',
          source: '测试来源',
          tags: [],
          targetAudience: 'test',
          isRead: false,
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    })

    render(<ComplianceRadarPage />)

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText('无控制点推送')).toBeInTheDocument()
    })

    // 验证控制点入口按钮不存在
    expect(screen.queryByText('查看控制点详情')).not.toBeInTheDocument()
  })

  it('AC1: 点击控制点入口后应该渲染共享抽屉并传入 radar 上下文', async () => {
    ;(getCompliancePushes as jest.Mock).mockResolvedValue({
      data: [
        {
          ...radarContext('push-3'),
          pushId: 'push-3',
          radarType: 'compliance',
          title: '打开抽屉的推送',
          summary: '测试摘要',
          relevanceScore: 0.95,
          priorityLevel: 3,
          weaknessCategories: [],
          url: 'https://example.com',
          publishDate: '2026-03-28',
          source: '测试来源',
          tags: [],
          targetAudience: 'test',
          isRead: false,
          controlId: 'ctrl-003',
          matchedControls: [
            {
              controlId: 'ctrl-003',
              controlName: '测试控制点',
              packSource: '测试包',
              priority: 'high',
            },
          ],
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    })

    const user = userEvent.setup()
    render(<ComplianceRadarPage />)

    await waitFor(() => {
      expect(screen.getByText('打开抽屉的推送')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '查看控制点详情' }))

    const drawerProbe = await screen.findByTestId('control-detail-drawer-probe')
    expect(drawerProbe).toHaveAttribute('data-control-id', 'ctrl-003')
    expect(drawerProbe).toHaveAttribute('data-organization-id', 'org-123')
    expect(drawerProbe).toHaveAttribute('data-source-module', 'radar')
    expect(drawerProbe).toHaveAttribute('data-source-record-id', 'push-3')
  })
})
