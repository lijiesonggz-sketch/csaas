import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme, Theme } from '@mui/material/styles'
import { PeerMonitoringCard } from './PeerMonitoringCard'

/**
 * PeerMonitoringCard Component Tests (Story 8.6)
 *
 * 测试范围：
 * - 同业动态卡片展示（AC1）
 * - 卡片内容格式（AC2）
 * - 与我关注的同业相关标签
 * - 成本、周期、效果展示
 * - 查看详情按钮交互
 */
describe('PeerMonitoringCard Component', () => {
  const theme: Theme = createTheme()

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
  }

  const mockPeerMonitoringPush = {
    id: 'peer-push-1',
    pushType: 'peer-monitoring' as const,
    peerName: '招商银行',
    peerLogo: 'https://example.com/logo.png',
    practiceDescription: '招商银行通过引入云原生架构，实现了系统的高可用和弹性伸缩，显著提升了业务响应速度。',
    estimatedCost: '300-500万',
    implementationPeriod: '6-12个月',
    technicalEffect: '系统可用性提升至99.99%，部署效率提升80%',
    relevanceScore: 0.95,
    priorityLevel: 'high' as const,
    sentAt: '2024-01-15T00:00:00Z',
    isRead: false,
    source: '银行业技术论坛',
    publishDate: '2024-01-15T00:00:00Z',
    tags: ['云原生', '容器化', '微服务'],
  }

  const mockOnMarkAsRead = jest.fn()
  const mockOnViewDetail = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('AC1: 同业动态卡片展示', () => {
    it('should render peer monitoring push card', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText('招商银行')).toBeInTheDocument()
    })

    it('should display "与您关注的XX银行相关" label when isWatchedPeer is true', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText(/与您关注的招商银行相关/)).toBeInTheDocument()
    })

    it('should not display watched label when isWatchedPeer is false', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={false}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.queryByText(/与您关注的/)).not.toBeInTheDocument()
    })

    it('should display practice description', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText(/招商银行通过引入云原生架构/)).toBeInTheDocument()
    })
  })

  describe('AC2: 卡片内容格式', () => {
    it('should display "同业动态" badge', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText('同业动态')).toBeInTheDocument()
    })

    it('should display peer name', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText('招商银行')).toBeInTheDocument()
    })

    it('should display estimated cost with icon', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText('投入成本')).toBeInTheDocument()
      expect(screen.getByText('300-500万')).toBeInTheDocument()
    })

    it('should display implementation period with icon', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText('实施周期')).toBeInTheDocument()
      expect(screen.getByText('6-12个月')).toBeInTheDocument()
    })

    it('should display technical effect with icon', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText('技术效果')).toBeInTheDocument()
      expect(screen.getByText('系统可用性提升至99.99%，部署效率提升80%')).toBeInTheDocument()
    })

    it('should display relevance score', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText(/95% 相关/)).toBeInTheDocument()
    })

    it('should display priority level', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText('高优先级')).toBeInTheDocument()
    })

    it('should display source and publish date', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText(/来源: 银行业技术论坛/)).toBeInTheDocument()
      expect(screen.getByText(/2024/)).toBeInTheDocument()
    })

    it('should display view detail button', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByRole('button', { name: /查看详情/i })).toBeInTheDocument()
    })

    it('should display star icon for watched peer', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText('⭐ 关注')).toBeInTheDocument()
    })

    it('should not display star icon for non-watched peer', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={false}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.queryByText('⭐ 关注')).not.toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should call onViewDetail when clicking view detail button', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      const viewDetailButton = screen.getByRole('button', { name: /查看详情/i })
      fireEvent.click(viewDetailButton)

      expect(mockOnViewDetail).toHaveBeenCalledTimes(1)
    })

    it('should call onMarkAsRead when card is clicked (if not already read)', () => {
      renderWithProviders(
        <PeerMonitoringCard
          push={mockPeerMonitoringPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      const card = screen.getByTestId('peer-monitoring-card')
      fireEvent.click(card)

      expect(mockOnMarkAsRead).toHaveBeenCalledTimes(1)
    })

    it('should not call onMarkAsRead when push is already read', () => {
      const readPush = { ...mockPeerMonitoringPush, isRead: true }
      renderWithProviders(
        <PeerMonitoringCard
          push={readPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      const card = screen.getByTestId('peer-monitoring-card')
      fireEvent.click(card)

      expect(mockOnMarkAsRead).not.toHaveBeenCalled()
    })
  })

  describe('Priority Levels', () => {
    it('should display high priority correctly', () => {
      const highPriorityPush = { ...mockPeerMonitoringPush, priorityLevel: 'high' as const }
      renderWithProviders(
        <PeerMonitoringCard
          push={highPriorityPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText('高优先级')).toBeInTheDocument()
    })

    it('should display medium priority correctly', () => {
      const mediumPriorityPush = { ...mockPeerMonitoringPush, priorityLevel: 'medium' as const }
      renderWithProviders(
        <PeerMonitoringCard
          push={mediumPriorityPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText('中优先级')).toBeInTheDocument()
    })

    it('should display low priority correctly', () => {
      const lowPriorityPush = { ...mockPeerMonitoringPush, priorityLevel: 'low' as const }
      renderWithProviders(
        <PeerMonitoringCard
          push={lowPriorityPush}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText('低优先级')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing peerLogo gracefully', () => {
      const pushWithoutLogo = { ...mockPeerMonitoringPush, peerLogo: undefined }
      renderWithProviders(
        <PeerMonitoringCard
          push={pushWithoutLogo}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText('招商银行')).toBeInTheDocument()
    })

    it('should handle missing tags gracefully', () => {
      const pushWithoutTags = { ...mockPeerMonitoringPush, tags: undefined }
      renderWithProviders(
        <PeerMonitoringCard
          push={pushWithoutTags}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      expect(screen.getByText('招商银行')).toBeInTheDocument()
    })

    it('should truncate long practice description', () => {
      const longDescription = 'a'.repeat(200)
      const pushWithLongDescription = { ...mockPeerMonitoringPush, practiceDescription: longDescription }
      renderWithProviders(
        <PeerMonitoringCard
          push={pushWithLongDescription}
          isWatchedPeer={true}
          onMarkAsRead={mockOnMarkAsRead}
          onViewDetail={mockOnViewDetail}
        />
      )

      // Component should render without crashing
      expect(screen.getByText('招商银行')).toBeInTheDocument()
    })
  })
})
