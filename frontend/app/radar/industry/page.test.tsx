import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme, Theme } from '@mui/material/styles'
import IndustryRadarPage from './page'
import { getIndustryPushes, getWatchedPeers, RadarPush } from '@/lib/api/radar'
import { useWebSocket } from '@/lib/hooks/useWebSocket'
import { useOrganizationStore } from '@/lib/stores/useOrganizationStore'

// Mock dependencies
jest.mock('@/lib/api/radar')
jest.mock('@/lib/hooks/useWebSocket')

// Mock zustand store properly
const mockOrgStore = {
  currentOrganization: { id: 'org-1', name: '测试银行' },
  organizations: [{ id: 'org-1', name: '测试银行' }],
  weaknesses: [],
  aggregatedWeaknesses: [],
  loading: false,
  error: null,
  fetchOrganizations: jest.fn().mockResolvedValue(undefined),
  setCurrentOrganization: jest.fn(),
  fetchWeaknesses: jest.fn().mockResolvedValue(undefined),
  clearError: jest.fn(),
  getState: jest.fn().mockReturnValue({
    currentOrganization: { id: 'org-1', name: '测试银行' },
    organizations: [{ id: 'org-1', name: '测试银行' }],
    weaknesses: [],
    aggregatedWeaknesses: [],
    loading: false,
    error: null,
    fetchOrganizations: jest.fn().mockResolvedValue(undefined),
    setCurrentOrganization: jest.fn(),
    fetchWeaknesses: jest.fn().mockResolvedValue(undefined),
    clearError: jest.fn(),
  }),
}

jest.mock('@/lib/stores/useOrganizationStore', () => ({
  useOrganizationStore: jest.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockOrgStore)
    }
    return mockOrgStore
  }),
  __esModule: true,
}))

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}))
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

const { useSearchParams, useRouter } = require('next/navigation')

/**
 * Industry Radar Page Tests (Story 3.3 - Phase 6)
 *
 * 测试范围：
 * - 页面渲染和布局
 * - 筛选器交互和状态持久化
 * - 推送列表显示
 * - WebSocket实时推送
 * - 空状态处理
 */
describe('Industry Radar Page', () => {
  const theme: Theme = createTheme()

  const mockPushes: RadarPush[] = [
    {
      pushId: 'industry-1',
      radarType: 'industry',
      title: '招商银行云原生转型实践',
      summary: '该银行采用Kubernetes实现容器化部署',
      relevanceScore: 0.95,
      priorityLevel: 1,
      weaknessCategories: ['系统架构'],
      publishDate: '2024-01-15T00:00:00Z',
      source: '银行业技术论坛',
      peerName: '招商银行',
      practiceDescription: '详细的实践描述...',
      estimatedCost: '300-500万',
      implementationPeriod: '6-12个月',
      technicalEffect: '系统可用性提升至99.99%',
      isRead: false,
    },
    {
      pushId: 'industry-2',
      radarType: 'industry',
      title: '平安银行微服务架构实践',
      summary: '该银行实施微服务架构改造',
      relevanceScore: 0.88,
      priorityLevel: 2,
      weaknessCategories: ['应用架构'],
      publishDate: '2024-01-10T00:00:00Z',
      source: '金融科技观察',
      peerName: '平安银行',
      practiceDescription: '微服务架构实践经验...',
      estimatedCost: '200-400万',
      implementationPeriod: '3-6个月',
      technicalEffect: '开发效率提升60%',
      isRead: false,
    },
  ]

  const mockWatchedPeers = [
    { id: 'peer-1', name: '招商银行' },
    { id: 'peer-2', name: '平安银行' },
  ]

  const mockSearchParams = new URLSearchParams()
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock API responses
    ;(getIndustryPushes as jest.Mock).mockResolvedValue({
      data: mockPushes,
      total: mockPushes.length,
    })
    ;(getWatchedPeers as jest.Mock).mockResolvedValue({
      data: mockWatchedPeers,
    })

    // Mock URL params
    mockSearchParams.set('filter', 'all')
    useSearchParams.mockReturnValue(mockSearchParams)
    useRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      pathname: '/radar/industry',
      query: {},
      asPath: '/radar/industry',
    })

    // Mock WebSocket
    ;(useWebSocket as jest.Mock).mockReturnValue({
      socket: {
        on: jest.fn(),
        off: jest.fn(),
      },
      isConnected: true,
    })

    // Set useOrganizationStore to return the mock
    const useOrganizationStoreMock = require('@/lib/stores/useOrganizationStore').useOrganizationStore
    useOrganizationStoreMock.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockOrgStore)
      }
      return mockOrgStore
    })
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
  }

  describe('Page Rendering', () => {
    it('should render page title', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('行业雷达 - 同业标杆学习')).toBeInTheDocument()
      })
    })

    it('should render breadcrumbs', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('雷达首页')).toBeInTheDocument()
        expect(screen.getByText('行业雷达')).toBeInTheDocument()
      })
    })

    it('should render Business icon', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        // Business icon is present as an SVG element
        const icons = document.querySelectorAll('svg')
        expect(icons.length).toBeGreaterThan(0)
      })
    })

    it('should render all filter chips', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('全部')).toBeInTheDocument()
        expect(screen.getByText('我关注的同业')).toBeInTheDocument()
        expect(screen.getByText('同规模机构')).toBeInTheDocument()
        expect(screen.getByText('同地区机构')).toBeInTheDocument()
      })
    })

    it('should display push count', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText(/共 \d+ 条推送/)).toBeInTheDocument()
      })
    })

    it('should render refresh button', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /刷新/i })).toBeInTheDocument()
      })
    })
  })

  describe('Filter Chips Display', () => {
    it('should render all four filter options', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        const allChip = screen.getByText('全部')
        const watchedChip = screen.getByText('我关注的同业')
        const scaleChip = screen.getByText('同规模机构')
        const regionChip = screen.getByText('同地区机构')

        expect(allChip).toBeInTheDocument()
        expect(watchedChip).toBeInTheDocument()
        expect(scaleChip).toBeInTheDocument()
        expect(regionChip).toBeInTheDocument()
      })
    })

    it('should highlight active filter', async () => {
      mockSearchParams.set('filter', 'watched')
      useSearchParams.mockReturnValue(mockSearchParams)

      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        const watchedChip = screen.getByText('我关注的同业')
        expect(watchedChip).toBeInTheDocument()
      })
    })
  })

  describe('URL State Persistence', () => {
    it('should read initial filter from URL', async () => {
      mockSearchParams.set('filter', 'watched')
      useSearchParams.mockReturnValue(mockSearchParams)

      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(getIndustryPushes).toHaveBeenCalled()
      })
    })

    it('should update URL when filter changes', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('我关注的同业')).toBeInTheDocument()
      })

      const watchedChip = screen.getByText('我关注的同业')
      fireEvent.click(watchedChip)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/radar/industry?filter=watched')
      })
    })

    it('should persist filter state to URL', async () => {
      mockSearchParams.set('filter', 'same-scale')
      useSearchParams.mockReturnValue(mockSearchParams)

      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('同规模机构')).toBeInTheDocument()
      })

      const scaleChip = screen.getByText('同规模机构')
      fireEvent.click(scaleChip)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled()
      })
    })
  })

  describe('Filter Functionality', () => {
    it('should call API with watched filter when "我关注的同业" is clicked', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('我关注的同业')).toBeInTheDocument()
      })

      const watchedChip = screen.getByText('我关注的同业')
      fireEvent.click(watchedChip)

      await waitFor(() => {
        expect(getIndustryPushes).toHaveBeenCalledWith(
          'org-1',
          expect.objectContaining({
            filter: 'watched',
          })
        )
      })
    })

    it('should call API with same-scale filter', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('同规模机构')).toBeInTheDocument()
      })

      const scaleChip = screen.getByText('同规模机构')
      fireEvent.click(scaleChip)

      await waitFor(() => {
        expect(getIndustryPushes).toHaveBeenCalledWith(
          'org-1',
          expect.objectContaining({
            filter: 'same-scale',
          })
        )
      })
    })

    it('should call API with same-region filter', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('同地区机构')).toBeInTheDocument()
      })

      const regionChip = screen.getByText('同地区机构')
      fireEvent.click(regionChip)

      await waitFor(() => {
        expect(getIndustryPushes).toHaveBeenCalledWith(
          'org-1',
          expect.objectContaining({
            filter: 'same-region',
          })
        )
      })
    })

    it('should reset to all filter', async () => {
      mockSearchParams.set('filter', 'watched')
      useSearchParams.mockReturnValue(mockSearchParams)

      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('全部')).toBeInTheDocument()
      })

      const allChip = screen.getByText('全部')
      fireEvent.click(allChip)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/radar/industry?filter=all')
      })
    })
  })

  describe('WebSocket Integration', () => {
    it('should establish WebSocket connection', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(useWebSocket).toHaveBeenCalledWith('org-1')
      })
    })

    it('should display connection status', async () => {
      ;(useWebSocket as jest.Mock).mockReturnValue({
        socket: { on: jest.fn(), off: jest.fn() },
        isConnected: true,
      })

      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText(/✓ 实时推送已连接/)).toBeInTheDocument()
      })
    })

    it('should display disconnected status', async () => {
      ;(useWebSocket as jest.Mock).mockReturnValue({
        socket: { on: jest.fn(), off: jest.fn() },
        isConnected: false,
      })

      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText(/⚠️ 实时推送连接中断/)).toBeInTheDocument()
      })
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no pushes', async () => {
      ;(getIndustryPushes as jest.Mock).mockResolvedValue({
        data: [],
        total: 0,
      })

      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('暂无行业雷达推送，请配置关注的同业机构')).toBeInTheDocument()
      })
    })

    it('should display link to settings page in empty state', async () => {
      ;(getIndustryPushes as jest.Mock).mockResolvedValue({
        data: [],
        total: 0,
      })

      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        const settingsLink = screen.getByRole('link', { name: /前往配置/i })
        expect(settingsLink).toBeInTheDocument()
        expect(settingsLink).toHaveAttribute('href', '/radar/settings')
      })
    })
  })

  describe('Loading State', () => {
    it('should display loading spinner initially', () => {
      ;(getIndustryPushes as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      )

      renderWithProviders(<IndustryRadarPage />)

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error message when API fails', async () => {
      ;(getIndustryPushes as jest.Mock).mockRejectedValue(new Error('网络错误'))

      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText(/网络错误/)).toBeInTheDocument()
      })
    })
  })

  describe('Push Display', () => {
    it('should display push cards', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('招商银行云原生转型实践')).toBeInTheDocument()
        expect(screen.getByText('平安银行微服务架构实践')).toBeInTheDocument()
      })
    })

    it('should display peer name in push card', async () => {
      renderWithProviders(<IndustryRadarPage />)

      await waitFor(() => {
        expect(screen.getByText('招商银行')).toBeInTheDocument()
        expect(screen.getByText('平安银行')).toBeInTheDocument()
      })
    })
  })
})
