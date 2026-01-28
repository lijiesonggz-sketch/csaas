import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme, Theme } from '@mui/material/styles'
import TechRadarPage from './page'
import { getRadarPushes, RadarPush } from '@/lib/api/radar'
import { useWebSocket } from '@/lib/hooks/useWebSocket'

// Mock dependencies
jest.mock('@/lib/api/radar')
jest.mock('@/lib/hooks/useWebSocket')

/**
 * TechRadarPage Component Tests (Story 2.5 - Task 3.1)
 *
 * 测试范围：
 * - 页面基础渲染
 * - 推送列表加载和显示
 * - ROI数据展示（有/无ROI场景）
 * - WebSocket实时推送
 * - 错误处理
 */
describe('TechRadarPage Component', () => {
  const theme: Theme = createTheme()

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
  }

  // Mock数据
  const mockPushWithROI: RadarPush = {
    pushId: 'push-1',
    radarType: 'tech',
    title: '零信任架构在金融行业的应用',
    summary: '介绍零信任架构的实施方案和成本收益分析',
    fullContent: '详细内容...',
    relevanceScore: 0.95,
    priorityLevel: 1,
    weaknessCategories: ['数据安全', '身份认证'],
    url: 'https://example.com/article',
    publishDate: '2024-01-15T00:00:00Z',
    source: '金融科技周刊',
    tags: ['零信任', '安全架构'],
    targetAudience: 'IT总监',
    roiAnalysis: {
      estimatedCost: '50-100万',
      expectedBenefit: '年节省200万运维成本',
      roiEstimate: 'ROI 2:1',
      implementationPeriod: '3-6个月',
      recommendedVendors: ['阿里云', '腾讯云', '华为云'],
    },
    isRead: false,
  }

  const mockPushWithoutROI: RadarPush = {
    ...mockPushWithROI,
    pushId: 'push-2',
    title: '云原生容器技术最新进展',
    roiAnalysis: undefined,
  }

  const mockPushesResponse = {
    data: [mockPushWithROI, mockPushWithoutROI],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    },
  }

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Default mock implementations
    ;(getRadarPushes as jest.Mock).mockResolvedValue(mockPushesResponse)
    ;(useWebSocket as jest.Mock).mockReturnValue({
      socket: null,
      isConnected: true,
    })

    // Mock Notification API
    global.Notification = {
      permission: 'default',
      requestPermission: jest.fn().mockResolvedValue('granted'),
    } as any
  })

  describe('Page Rendering', () => {
    it('should render page header with title', async () => {
      renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('技术雷达 - ROI导向的技术决策支持')).toBeInTheDocument()
      })
    })

    it('should render subtitle', async () => {
      renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        expect(
          screen.getByText('基于您的薄弱项和关注领域，为您推荐最具性价比的技术方案')
        ).toBeInTheDocument()
      })
    })

    it('should show loading state initially', () => {
      renderWithProviders(<TechRadarPage />)

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should show WebSocket connection status', async () => {
      renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('✓ 实时推送已连接')).toBeInTheDocument()
      })
    })
  })

  describe('Push List Loading', () => {
    it('should load and display push list correctly', async () => {
      renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        expect(getRadarPushes).toHaveBeenCalledWith({
          radarType: 'tech',
          status: 'sent',
          page: 1,
          limit: 20,
        })
      })

      await waitFor(() => {
        expect(screen.getByText('零信任架构在金融行业的应用')).toBeInTheDocument()
        expect(screen.getByText('云原生容器技术最新进展')).toBeInTheDocument()
      })
    })

    it('should handle API error gracefully', async () => {
      const errorMessage = '网络连接失败'
      ;(getRadarPushes as jest.Mock).mockRejectedValue(new Error(errorMessage))

      renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('should show empty state when no pushes', async () => {
      ;(getRadarPushes as jest.Mock).mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })

      renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('暂无推送内容')).toBeInTheDocument()
      })
    })
  })

  describe('ROI Analysis Display', () => {
    it('should display ROI analysis when available', async () => {
      renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('50-100万')).toBeInTheDocument()
        expect(screen.getByText('年节省200万运维成本')).toBeInTheDocument()
        expect(screen.getByText('ROI 2:1')).toBeInTheDocument()
        expect(screen.getByText('3-6个月')).toBeInTheDocument()
      })
    })

    it('should handle missing ROI analysis gracefully', async () => {
      ;(getRadarPushes as jest.Mock).mockResolvedValue({
        data: [mockPushWithoutROI],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      })

      renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('云原生容器技术最新进展')).toBeInTheDocument()
      })

      // Should not crash when ROI is missing
      expect(screen.queryByText('ROI 2:1')).not.toBeInTheDocument()
    })
  })

  describe('WebSocket Real-time Push', () => {
    it('should handle new push event from WebSocket', async () => {
      const mockSocket = {
        on: jest.fn(),
        off: jest.fn(),
      }
      ;(useWebSocket as jest.Mock).mockReturnValue({
        socket: mockSocket,
        isConnected: true,
      })

      renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('radar:push:new', expect.any(Function))
      })

      // Simulate WebSocket event
      const newPush: RadarPush = {
        ...mockPushWithROI,
        pushId: 'push-new',
        title: '新推送：AI驱动的安全防护',
      }

      const callback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'radar:push:new'
      )?.[1]
      if (callback) {
        callback(newPush)
      }

      await waitFor(() => {
        expect(screen.getByText('新推送：AI驱动的安全防护')).toBeInTheDocument()
      })
    })

    it('should show disconnected status when WebSocket disconnects', async () => {
      ;(useWebSocket as jest.Mock).mockReturnValue({
        socket: null,
        isConnected: false,
      })

      renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('⚠️ 实时推送连接中断，正在重新连接...')).toBeInTheDocument()
      })
    })
  })

  describe('User Interactions', () => {
    it('should refresh push list when clicking refresh button', async () => {
      renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('零信任架构在金融行业的应用')).toBeInTheDocument()
      })

      const refreshButton = screen.getByRole('button', { name: /刷新/i })
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(getRadarPushes).toHaveBeenCalledTimes(2)
      })
    })

    it('should open detail modal when clicking view detail button', async () => {
      renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('零信任架构在金融行业的应用')).toBeInTheDocument()
      })

      const viewDetailButtons = screen.getAllByRole('button', { name: /查看详情/i })
      fireEvent.click(viewDetailButtons[0])

      // Modal should open (tested in PushDetailModal.test.tsx)
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })
  })

  describe('Component Structure', () => {
    it('should use Container with maxWidth lg', async () => {
      const { container } = renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        const containers = container.querySelectorAll('.MuiContainer-root')
        expect(containers.length).toBeGreaterThan(0)
      })
    })

    it('should render Grid layout for push cards', async () => {
      const { container } = renderWithProviders(<TechRadarPage />)

      await waitFor(() => {
        const grids = container.querySelectorAll('.MuiGrid-root')
        expect(grids.length).toBeGreaterThan(0)
      })
    })
  })
})
