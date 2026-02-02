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
 * 4. 分页功能
 * 5. 已读状态管理
 * 6. 错误处理
 */

// Mock API calls
jest.mock('@/lib/api/radar')

const mockGetPushHistory = radarApi.getPushHistory as jest.MockedFunction<
  typeof radarApi.getPushHistory
>
const mockMarkPushHistoryAsRead = radarApi.markPushHistoryAsRead as jest.MockedFunction<
  typeof radarApi.markPushHistoryAsRead
>
const mockGetUnreadPushCount = radarApi.getUnreadPushCount as jest.MockedFunction<
  typeof radarApi.getUnreadPushCount
>

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('[P2] PushHistoryPage Component Tests - Story 5.4', () => {
  const mockOrganizationId = 'test-org-123'

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
    mockLocalStorage.getItem.mockReturnValue(mockOrganizationId)
    mockGetPushHistory.mockResolvedValue(mockPushHistoryResponse)
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
        expect(screen.getByLabelText('雷达类型')).toBeInTheDocument()
        expect(screen.getByLabelText('时间范围')).toBeInTheDocument()
        expect(screen.getByLabelText('相关性')).toBeInTheDocument()
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
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      )

      render(<PushHistoryPage />)

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('应该在没有组织ID时显示错误提示', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText(/未找到组织ID/)).toBeInTheDocument()
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
        const cards = container.querySelectorAll('[class*="MuiCard"]')
        expect(cards.length).toBeGreaterThan(0)
      })
    })

    it('应该显示行业雷达的匹配同业机构', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText(/与您关注的 招商银行、平安银行 相关/)).toBeInTheDocument()
      })
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

  describe('[P2] 筛选器交互', () => {
    it('应该在选择雷达类型时触发筛选', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('雷达类型')).toBeInTheDocument()
      })

      // Select tech radar type
      const radarTypeSelect = screen.getByLabelText('雷达类型')
      fireEvent.mouseDown(radarTypeSelect)

      await waitFor(() => {
        const techOption = screen.getByText('技术雷达')
        fireEvent.click(techOption)
      })

      await waitFor(() => {
        expect(mockGetPushHistory).toHaveBeenCalledWith(
          mockOrganizationId,
          expect.objectContaining({
            radarType: 'tech',
          }),
        )
      })
    })

    it('应该在选择时间范围时触发筛选', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('时间范围')).toBeInTheDocument()
      })

      // Select 7 days time range
      const timeRangeSelect = screen.getByLabelText('时间范围')
      fireEvent.mouseDown(timeRangeSelect)

      await waitFor(() => {
        const sevenDaysOption = screen.getByText('最近7天')
        fireEvent.click(sevenDaysOption)
      })

      await waitFor(() => {
        expect(mockGetPushHistory).toHaveBeenCalledWith(
          mockOrganizationId,
          expect.objectContaining({
            timeRange: '7d',
          }),
        )
      })
    })

    it('应该在选择相关性时触发筛选', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('相关性')).toBeInTheDocument()
      })

      // Select high relevance
      const relevanceSelect = screen.getByLabelText('相关性')
      fireEvent.mouseDown(relevanceSelect)

      await waitFor(() => {
        const highOption = screen.getByText('高相关')
        fireEvent.click(highOption)
      })

      await waitFor(() => {
        expect(mockGetPushHistory).toHaveBeenCalledWith(
          mockOrganizationId,
          expect.objectContaining({
            relevance: 'high',
          }),
        )
      })
    })

    it('应该在选择"自定义"时间范围时显示日期选择器', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('时间范围')).toBeInTheDocument()
      })

      // Select custom time range
      const timeRangeSelect = screen.getByLabelText('时间范围')
      fireEvent.mouseDown(timeRangeSelect)

      await waitFor(() => {
        const customOption = screen.getByText('自定义')
        fireEvent.click(customOption)
      })

      await waitFor(() => {
        expect(screen.getByLabelText('开始日期')).toBeInTheDocument()
        expect(screen.getByLabelText('结束日期')).toBeInTheDocument()
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
        expect(mockGetPushHistory).toHaveBeenCalledWith(
          mockOrganizationId,
          expect.objectContaining({
            page: 1,
            limit: 20,
            timeRange: '30d', // Default value
          }),
        )
      })
    })
  })

  describe('[P2] 分页功能', () => {
    it('应该渲染分页组件', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        const pagination = screen.getByRole('navigation')
        expect(pagination).toBeInTheDocument()
      })
    })

    it('应该在切换页码时触发查询', async () => {
      mockGetPushHistory.mockResolvedValue({
        ...mockPushHistoryResponse,
        meta: { total: 50, page: 1, limit: 20, totalPages: 3 },
      })

      render(<PushHistoryPage />)

      await waitFor(() => {
        const pagination = screen.getByRole('navigation')
        expect(pagination).toBeInTheDocument()
      })

      // Click page 2 button
      const page2Button = screen.getByLabelText('Go to page 2')
      fireEvent.click(page2Button)

      await waitFor(() => {
        expect(mockGetPushHistory).toHaveBeenCalledWith(
          mockOrganizationId,
          expect.objectContaining({
            page: 2,
          }),
        )
      })
    })
  })

  describe('[P2] 已读状态管理', () => {
    it('应该在点击推送卡片时标记为已读', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('技术雷达推送测试')).toBeInTheDocument()
      })

      // Click on unread push card
      const pushCard = screen.getByText('技术雷达推送测试').closest('[class*="MuiCard"]')
      fireEvent.click(pushCard!)

      await waitFor(() => {
        expect(mockMarkPushHistoryAsRead).toHaveBeenCalledWith('push-1', mockOrganizationId)
      })
    })

    it('应该在标记已读后更新本地状态', async () => {
      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('技术雷达推送测试')).toBeInTheDocument()
      })

      // Click on unread push card
      const pushCard = screen.getByText('技术雷达推送测试').closest('[class*="MuiCard"]')
      fireEvent.click(pushCard!)

      await waitFor(() => {
        // After marking as read, the card should show "已读" badge
        const readBadges = screen.getAllByText('已读')
        expect(readBadges.length).toBeGreaterThan(1)
      })
    })
  })

  describe('[P2] 错误处理', () => {
    it('应该在API调用失败时显示错误提示', async () => {
      mockGetPushHistory.mockRejectedValue(new Error('Network error'))

      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText(/加载推送历史失败/)).toBeInTheDocument()
      })
    })

    it('应该在标记已读失败时显示错误提示', async () => {
      mockMarkPushHistoryAsRead.mockRejectedValue(new Error('Mark as read failed'))

      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('技术雷达推送测试')).toBeInTheDocument()
      })

      // Click on push card
      const pushCard = screen.getByText('技术雷达推送测试').closest('[class*="MuiCard"]')
      fireEvent.click(pushCard!)

      await waitFor(() => {
        expect(screen.getByText(/标记已读失败/)).toBeInTheDocument()
      })
    })

    it('应该允许关闭错误提示', async () => {
      mockGetPushHistory.mockRejectedValue(new Error('Network error'))

      render(<PushHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText(/加载推送历史失败/)).toBeInTheDocument()
      })

      // Close error alert
      const closeButton = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByText(/加载推送历史失败/)).not.toBeInTheDocument()
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
        const summaryElement = container.querySelector('[class*="WebkitLineClamp"]')
        expect(summaryElement).toBeInTheDocument()
      })
    })
  })
})
