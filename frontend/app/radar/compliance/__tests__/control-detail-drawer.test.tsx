/**
 * Story 7.2: 雷达页面控制点详情抽屉集成测试
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ComplianceRadarPage from '../page'

// Mock dependencies
jest.mock('@/lib/api/radar', () => ({
  getCompliancePushes: jest.fn(),
}))

jest.mock('@/lib/hooks/useWebSocket', () => ({
  useWebSocket: jest.fn(() => ({
    socket: null,
    isConnected: false,
  })),
}))

jest.mock('@/lib/stores/useOrganizationStore', () => ({
  useOrganizationStore: jest.fn((selector) => {
    const state = {
      currentOrganization: { id: 'org-123', name: 'Test Org' },
      fetchOrganizations: jest.fn(),
    }
    return selector(state)
  }),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

describe('Story 7.2: Control Detail Drawer Integration', () => {
  it('AC1: 应该在有 matchedControls 时显示控制点入口按钮', async () => {
    const { getCompliancePushes } = require('@/lib/api/radar')

    // Mock push with matchedControls
    ;(getCompliancePushes as jest.Mock).mockResolvedValue({
      data: [
        {
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
    const { getCompliancePushes } = require('@/lib/api/radar')

    // Mock push without matchedControls
    ;(getCompliancePushes as jest.Mock).mockResolvedValue({
      data: [
        {
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
})
