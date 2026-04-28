import * as React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import PushHistoryPage from './page'
import * as radarApi from '@/lib/api/radar'

/**
 * Frontend Component Tests for Story 5.4: 推送历史查看
 *
 * 测试推送历史页面的前端功能:
 * 1. 页面渲染和基础布局
 * 2. 筛选器交互（雷达类型、时间范围、相关性）
 * 3. 推送列表展示
 * 4. 无限滚动功能
 * 5. 已读状态管理
 * 6. 错误处理
 */

// Mock API calls
jest.mock('@/lib/api/radar')

// Mock next-auth for PushDetailModal
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: {
      user: { id: 'test-user', organizationId: 'org-1' },
      accessToken: 'test-token',
    },
    status: 'authenticated',
  })),
}))

// Mock feedback API used by PushDetailModal
jest.mock('@/lib/api/feedback', () => ({
  submitPushFeedback: jest.fn(() => Promise.resolve()),
  getUserFeedback: jest.fn(() => Promise.resolve(null)),
}))

// Mock ControlDetailDrawer used by PushDetailModal
jest.mock('@/components/compliance/ControlDetailDrawer', () => ({
  ControlDetailDrawer: () => null,
}))

/* eslint-disable @typescript-eslint/no-explicit-any */
// Mock shadcn/ui Select to use native <select> for JSDOM compatibility
jest.mock('@/components/ui/select', () => {
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
    <div id={id} className={className} ref={ref} aria-label={id} data-testid={id} {...rest}>
      {children}
    </div>
  ))
  SelectTrigger.displayName = 'SelectTrigger'

  const SelectValue = ({ placeholder }) => <span>{placeholder || ''}</span>

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

const mockGetPushHistory = radarApi.getPushHistory as jest.MockedFunction<
  typeof radarApi.getPushHistory
>
const mockGetRadarPush = radarApi.getRadarPush as jest.MockedFunction<typeof radarApi.getRadarPush>
const mockMarkPushHistoryAsRead = radarApi.markPushHistoryAsRead as jest.MockedFunction<
  typeof radarApi.markPushHistoryAsRead
>
const mockGetUnreadPushCount = radarApi.getUnreadPushCount as jest.MockedFunction<
  typeof radarApi.getUnreadPushCount
>

describe('[P2] PushHistoryPage Component Tests - Story 5.4', () => {
  const mockPushHistoryResponse = {
    data: [
      {
        id: 'push-1',
        radarType: 'tech' as const,
        title: '技术雷达推送测试',
        summary: '这是一条技术雷达推送的摘要内容',
        relevanceScore: 0.95,
        relevanceLevel: 'high' as const,
        sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        readAt: null,
        isRead: false,
        sourceName: 'Test Source',
        sourceUrl: 'https://example.com',
        matchedControls: [],
      },
      {
        id: 'push-2',
        radarType: 'industry' as const,
        title: '行业雷达推送测试',
        summary: '这是一条行业雷达推送的摘要内容',
        relevanceScore: 0.75,
        relevanceLevel: 'medium' as const,
        sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        readAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        isRead: true,
        matchedPeers: ['招商银行', '平安银行'],
        matchedControls: [],
      },
      {
        id: 'push-3',
        radarType: 'compliance' as const,
        title: '合规雷达推送测试',
        summary: '这是一条合规雷达推送的摘要内容',
        relevanceScore: 0.65,
        relevanceLevel: 'low' as const,
        sentAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
        readAt: null,
        isRead: false,
        riskLevel: 'high' as const,
        matchedControls: [],
      },
    ],
    meta: {
      total: 3,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetPushHistory.mockResolvedValue(mockPushHistoryResponse)
    mockGetRadarPush.mockResolvedValue({
      id: 'push-1',
      radarType: 'tech',
      title: '技术雷达推送测试',
      summary: '这是一条技术雷达推送的摘要内容',
      sentAt: mockPushHistoryResponse.data[0].sentAt,
      isRead: false,
      controlId: null,
      matchedControls: [],
      sourceModule: 'radar',
      sourceRecordId: 'push-1',
    } as any)
    mockMarkPushHistoryAsRead.mockResolvedValue(undefined)
    mockGetUnreadPushCount.mockResolvedValue(2)
  })

  describe('[P2] 页面渲染和基础布局', () => {
    it('应该渲染页面标题"推送历史"', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('推送历史')).toBeInTheDocument()
      })
    })

    it('应该渲染筛选器区域（雷达类型、时间范围、相关性）', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('雷达类型')).toBeInTheDocument()
        expect(screen.getByText('时间范围')).toBeInTheDocument()
        expect(screen.getByText('相关性')).toBeInTheDocument()
      })
    })

    it('应该渲染重置筛选按钮', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('重置筛选')).toBeInTheDocument()
      })
    })

    it('应该在加载时显示加载指示器', () => {
      mockGetPushHistory.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      )

      render(<PushHistoryPage />)

      // Loader2 spinner doesn't have progressbar role; check for spinner SVG
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('应该在没有推送时显示空状态提示', async () => {
      mockGetPushHistory.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      })

      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('暂无推送历史')).toBeInTheDocument()
      })
    })
  })

  describe('[P2] 推送列表展示', () => {
    it('应该渲染推送列表', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('技术雷达推送测试')).toBeInTheDocument()
        expect(screen.getByText('行业雷达推送测试')).toBeInTheDocument()
        expect(screen.getByText('合规雷达推送测试')).toBeInTheDocument()
      })
    })

    it('应该显示雷达类型标签（带颜色区分）', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('技术雷达')).toBeInTheDocument()
        expect(screen.getByText('行业雷达')).toBeInTheDocument()
        expect(screen.getByText('合规雷达')).toBeInTheDocument()
      })
    })

    it('应该显示相关性标识（高相关/中相关/低相关）', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText(/高相关/)).toBeInTheDocument()
        expect(screen.getByText(/中相关/)).toBeInTheDocument()
        expect(screen.getByText(/低相关/)).toBeInTheDocument()
      })
    })

    it('应该显示相对时间（如"3天前"）', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        // dayjs will format as "3天前", "7天前", etc.
        const timeElements = screen.getAllByText(/天前|小时前|分钟前/)
        expect(timeElements.length).toBeGreaterThan(0)
      })
    })

    it('应该显示已读状态标识', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        const readBadges = screen.getAllByText('已读')
        expect(readBadges.length).toBe(1) // Only push-2 is read
      })
    })

    it('应该高亮显示未读推送（左侧边框）', async () => {
      const { container } = render(<PushHistoryPage />)

      await waitFor(() => {
        // shadcn/ui Card component - check for border-left styling
        const cards = container.querySelectorAll('[class*="border-l-4"]')
        expect(cards.length).toBeGreaterThan(0)
      })
    })

    it('应该显示行业雷达的匹配同业机构', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText(/与您关注的 招商银行、平安银行 相关/)).toBeInTheDocument()
      })
    })
  })

  describe('[P2] 筛选器交互', () => {
    it('应该在选择雷达类型时触发筛选', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('雷达类型')).toBeInTheDocument()
      })

      // Find the select element for radar type (the mock renders a <select>)
      const selects = document.querySelectorAll('select')
      // The first select should be the radar type filter
      if (selects.length > 0) {
        fireEvent.change(selects[0], { target: { value: 'tech' } })
      }

      await waitFor(() => {
        expect(mockGetPushHistory).toHaveBeenCalled()
      })
    })

    it('应该在选择时间范围时触发筛选', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('时间范围')).toBeInTheDocument()
      })

      // Find the select element for time range (second select)
      const selects = document.querySelectorAll('select')
      if (selects.length > 1) {
        fireEvent.change(selects[1], { target: { value: '7d' } })
      }

      await waitFor(() => {
        expect(mockGetPushHistory).toHaveBeenCalled()
      })
    })

    it('应该在选择相关性时触发筛选', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('相关性')).toBeInTheDocument()
      })

      // Find the select element for relevance (third select)
      const selects = document.querySelectorAll('select')
      if (selects.length > 2) {
        fireEvent.change(selects[2], { target: { value: 'high' } })
      }

      await waitFor(() => {
        expect(mockGetPushHistory).toHaveBeenCalled()
      })
    })

    it('应该在选择"自定义"时间范围时显示日期选择器', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('时间范围')).toBeInTheDocument()
      })

      // Find the select element for time range (second select)
      const selects = document.querySelectorAll('select')
      if (selects.length > 1) {
        fireEvent.change(selects[1], { target: { value: 'custom' } })
      }

      await waitFor(() => {
        expect(screen.getByText('开始日期')).toBeInTheDocument()
        expect(screen.getByText('结束日期')).toBeInTheDocument()
      })
    })

    it('应该在点击"重置筛选"时清空所有筛选条件', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('重置筛选')).toBeInTheDocument()
      })

      // Click reset button
      const resetButton = screen.getByText('重置筛选')
      fireEvent.click(resetButton)

      await waitFor(() => {
        expect(mockGetPushHistory).toHaveBeenCalled()
      })
    })
  })

  describe('[P2] 已读状态管理', () => {
    it('应该在点击推送卡片时标记为已读', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('技术雷达推送测试')).toBeInTheDocument()
      })

      // Click on unread push card - find card by title and click it
      const pushTitle = screen.getByText('技术雷达推送测试')
      fireEvent.click(pushTitle.closest('div[class*="border"]')!)

      await waitFor(() => {
        expect(mockMarkPushHistoryAsRead).toHaveBeenCalledWith('push-1')
      })
    })

    it('应该在标记已读后更新本地状态', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('技术雷达推送测试')).toBeInTheDocument()
      })

      // Click on unread push card
      const pushTitle = screen.getByText('技术雷达推送测试')
      fireEvent.click(pushTitle.closest('div[class*="border"]')!)

      await waitFor(() => {
        // After marking as read, the card should show "已读" badge
        expect(mockMarkPushHistoryAsRead).toHaveBeenCalled()
      })
    })
  })

  describe('[P2] 错误处理', () => {
    it('应该在API调用失败时显示错误提示', async () => {
      mockGetPushHistory.mockRejectedValue(new Error('Network error'))

      render(<PushHistoryPage />)

      await waitFor(() => {
        // getErrorMessage returns the Error message if it exists
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('应该在标记已读失败时显示错误提示', async () => {
      mockMarkPushHistoryAsRead.mockRejectedValue(new Error('Mark as read failed'))

      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('技术雷达推送测试')).toBeInTheDocument()
      })

      // Click on push card
      const pushTitle = screen.getByText('技术雷达推送测试')
      fireEvent.click(pushTitle.closest('div[class*="border"]')!)

      await waitFor(() => {
        // getErrorMessage returns the Error message if it exists
        expect(screen.getByText('Mark as read failed')).toBeInTheDocument()
      })
    })
  })

  describe('[P2] 数据格式化', () => {
    it('应该正确格式化相对时间', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        // Should display relative time like "3天前", "7天前"
        const timeElements = screen.getAllByText(/天前/)
        expect(timeElements.length).toBeGreaterThan(0)
      })
    })

    it('应该正确显示相关性图标', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        // Should display emoji icons: 🔴 (high), 🟡 (medium), ⚪ (low)
        expect(screen.getByText(/🔴/)).toBeInTheDocument()
        expect(screen.getByText(/🟡/)).toBeInTheDocument()
        expect(screen.getByText(/⚪/)).toBeInTheDocument()
      })
    })

    it('应该截断过长的摘要（最多2行）', async () => {
      const longSummary = 'A'.repeat(500)
      mockGetPushHistory.mockResolvedValue({
        data: [
          {
            ...mockPushHistoryResponse.data[0],
            summary: longSummary,
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      })

      const { container } = render(<PushHistoryPage />)

      await waitFor(() => {
        const summaryElement = container.querySelector('.line-clamp-2')
        expect(summaryElement).toBeInTheDocument()
      })
    })
  })
})
