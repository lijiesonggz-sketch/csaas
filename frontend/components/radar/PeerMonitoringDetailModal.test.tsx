import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme, Theme } from '@mui/material/styles'
import { PeerMonitoringDetailModal } from './PeerMonitoringDetailModal'

/**
 * PeerMonitoringDetailModal Component Tests (Story 8.6 - AC3)
 *
 * 测试范围：
 * - 详情弹窗展示
 * - 同业机构背景显示
 * - 技术实践详细描述
 * - 投入成本/实施周期/效果
 * - 可借鉴点总结
 * - 信息来源和发布日期
 * - 相关技术标签
 * - 收藏功能
 * - 标记已读功能
 */
describe('PeerMonitoringDetailModal Component', () => {
  const theme: Theme = createTheme()

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
  }

  const mockPush = {
    id: 'peer-push-1',
    pushType: 'peer-monitoring' as const,
    peerName: '招商银行',
    peerLogo: 'https://example.com/logo.png',
    peerBackground: '招商银行是中国领先的商业银行，在金融科技领域具有深厚的积累和创新实践。',
    practiceDescription: '招商银行通过引入云原生架构，实现了系统的高可用和弹性伸缩。具体包括：\n1. 采用Kubernetes容器编排平台\n2. 引入服务网格Istio提升微服务治理能力\n3. 构建完整的CI/CD流水线',
    estimatedCost: '300-500万',
    implementationPeriod: '6-12个月',
    technicalEffect: '系统可用性提升至99.99%，部署效率提升80%，资源利用率提升60%',
    learnablePoints: [
      '云原生架构是数字化转型的关键技术',
      '渐进式迁移比全面替换风险更低',
      '自动化测试和部署是提升效率的核心',
    ],
    source: '银行业技术论坛',
    publishDate: '2024-01-15T00:00:00Z',
    sentAt: '2024-01-15T00:00:00Z',
    tags: ['云原生', '容器化', '微服务', 'DevOps', 'Kubernetes'],
    relevanceScore: 0.95,
    priorityLevel: 'high' as const,
    isRead: false,
    isBookmarked: false,
  }

  const mockOnClose = jest.fn()
  const mockOnBookmark = jest.fn()
  const mockOnMarkAsRead = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('AC3: 详情弹窗展示', () => {
    it('should render modal when open is true', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should not render modal when open is false', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={false}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should display peer name in title', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByText('招商银行')).toBeInTheDocument()
    })

    it('should display "同业动态" badge', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByText('同业动态')).toBeInTheDocument()
    })
  })

  describe('同业机构背景', () => {
    it('should display peer background section', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByText('同业机构背景')).toBeInTheDocument()
      expect(screen.getByText(/招商银行是中国领先的商业银行/)).toBeInTheDocument()
    })

    it('should handle missing peer background gracefully', () => {
      const pushWithoutBackground = { ...mockPush, peerBackground: undefined }
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={pushWithoutBackground}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      // Should not show peer background section
      expect(screen.queryByText('同业机构背景')).not.toBeInTheDocument()
    })
  })

  describe('技术实践详细描述', () => {
    it('should display practice description section', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByText('技术实践详细描述')).toBeInTheDocument()
      expect(screen.getByText(/采用Kubernetes容器编排平台/)).toBeInTheDocument()
    })
  })

  describe('投入成本/实施周期/效果', () => {
    it('should display estimated cost section', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByText('投入成本')).toBeInTheDocument()
      expect(screen.getByText('300-500万')).toBeInTheDocument()
    })

    it('should display implementation period section', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByText('实施周期')).toBeInTheDocument()
      expect(screen.getByText('6-12个月')).toBeInTheDocument()
    })

    it('should display technical effect section', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByText('技术效果')).toBeInTheDocument()
      expect(screen.getByText('系统可用性提升至99.99%，部署效率提升80%，资源利用率提升60%')).toBeInTheDocument()
    })
  })

  describe('可借鉴点总结', () => {
    it('should display learnable points section', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByText('可借鉴点总结')).toBeInTheDocument()
      expect(screen.getByText(/云原生架构是数字化转型的关键技术/)).toBeInTheDocument()
      expect(screen.getByText(/渐进式迁移比全面替换风险更低/)).toBeInTheDocument()
      expect(screen.getByText(/自动化测试和部署是提升效率的核心/)).toBeInTheDocument()
    })

    it('should handle missing learnable points gracefully', () => {
      const pushWithoutLearnablePoints = { ...mockPush, learnablePoints: undefined }
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={pushWithoutLearnablePoints}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.queryByText('可借鉴点总结')).not.toBeInTheDocument()
    })
  })

  describe('信息来源和发布日期', () => {
    it('should display source information', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByText(/来源: 银行业技术论坛/)).toBeInTheDocument()
    })

    it('should display publish date', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByText(/2024/)).toBeInTheDocument()
    })
  })

  describe('相关技术标签', () => {
    it('should display tags', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByText('相关技术')).toBeInTheDocument()
      expect(screen.getByText('云原生')).toBeInTheDocument()
      expect(screen.getByText('容器化')).toBeInTheDocument()
      expect(screen.getByText('微服务')).toBeInTheDocument()
    })
  })

  describe('收藏功能', () => {
    it('should display bookmark button', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByRole('button', { name: /收藏/i })).toBeInTheDocument()
    })

    it('should call onBookmark when clicking bookmark button', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      const bookmarkButton = screen.getByRole('button', { name: /收藏/i })
      fireEvent.click(bookmarkButton)

      expect(mockOnBookmark).toHaveBeenCalledTimes(1)
    })

    it('should show "已收藏" when isBookmarked is true', () => {
      const bookmarkedPush = { ...mockPush, isBookmarked: true }
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={bookmarkedPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByRole('button', { name: /已收藏/i })).toBeInTheDocument()
    })
  })

  describe('标记已读功能', () => {
    it('should display mark as read button when not read', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByRole('button', { name: /标记为已读/i })).toBeInTheDocument()
    })

    it('should call onMarkAsRead when clicking mark as read button', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      const markAsReadButton = screen.getByRole('button', { name: /标记为已读/i })
      fireEvent.click(markAsReadButton)

      expect(mockOnMarkAsRead).toHaveBeenCalledTimes(1)
    })

    it('should show "已读" and disable button when isRead is true', () => {
      const readPush = { ...mockPush, isRead: true }
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={readPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      const readButton = screen.getByRole('button', { name: /已读/i })
      expect(readButton).toBeInTheDocument()
      expect(readButton).toBeDisabled()
    })
  })

  describe('关闭功能', () => {
    it('should call onClose when clicking close button', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      const closeButton = screen.getByRole('button', { name: /关闭/i })
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('相关性评分', () => {
    it('should display relevance score', () => {
      renderWithProviders(
        <PeerMonitoringDetailModal
          open={true}
          push={mockPush}
          onClose={mockOnClose}
          onBookmark={mockOnBookmark}
          onMarkAsRead={mockOnMarkAsRead}
        />
      )

      expect(screen.getByText(/95% 相关/)).toBeInTheDocument()
    })
  })
})
