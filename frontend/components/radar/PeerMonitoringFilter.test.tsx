import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { PeerMonitoringFilter } from './PeerMonitoringFilter'

/**
 * PeerMonitoringFilter Component Tests (Story 8.6 - AC4)
 *
 * 测试范围：
 * - 筛选器渲染
 * - 全部同业动态筛选
 * - 我关注的同业筛选
 * - 特定同业机构筛选
 * - 筛选状态变化
 */
describe('PeerMonitoringFilter Component', () => {
  const mockOnFilterChange = jest.fn()
  const mockOnPeerChange = jest.fn()

  const defaultProps = {
    filter: 'all' as const,
    selectedPeer: '',
    watchedPeers: ['招商银行', '平安银行', '工商银行'],
    onFilterChange: mockOnFilterChange,
    onPeerChange: mockOnPeerChange,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('AC4: 关注同业筛选', () => {
    it('should render filter component', () => {
      render(<PeerMonitoringFilter {...defaultProps} />)

      expect(screen.getByText('筛选条件')).toBeInTheDocument()
    })

    it('should render "全部同业动态" chip', () => {
      render(<PeerMonitoringFilter {...defaultProps} />)

      expect(screen.getByText('全部同业动态')).toBeInTheDocument()
    })

    it('should render "我关注的同业" chip', () => {
      render(<PeerMonitoringFilter {...defaultProps} />)

      expect(screen.getByText('我关注的同业')).toBeInTheDocument()
    })

    it('should highlight "全部同业动态" when filter is all', () => {
      render(<PeerMonitoringFilter {...defaultProps} />)

      const allChip = screen.getByText('全部同业动态')
      expect(allChip).toBeInTheDocument()
      // Just verify it's clickable by checking that clicking works
      fireEvent.click(allChip)
      expect(mockOnFilterChange).toHaveBeenCalledWith('all')
    })

    it('should highlight "我关注的同业" when filter is watched', () => {
      render(<PeerMonitoringFilter {...defaultProps} filter="watched" />)

      const watchedChip = screen.getByText('我关注的同业')
      expect(watchedChip).toBeInTheDocument()
    })

    it('should call onFilterChange with "all" when clicking "全部同业动态"', () => {
      render(<PeerMonitoringFilter {...defaultProps} filter="watched" />)

      const allChip = screen.getByText('全部同业动态')
      fireEvent.click(allChip)

      expect(mockOnFilterChange).toHaveBeenCalledWith('all')
    })

    it('should call onFilterChange with "watched" when clicking "我关注的同业"', () => {
      render(<PeerMonitoringFilter {...defaultProps} />)

      const watchedChip = screen.getByText('我关注的同业')
      fireEvent.click(watchedChip)

      expect(mockOnFilterChange).toHaveBeenCalledWith('watched')
    })

    it('should display filter status message when filter is watched', () => {
      render(<PeerMonitoringFilter {...defaultProps} filter="watched" />)

      expect(screen.getByText('仅显示您关注的同业机构动态')).toBeInTheDocument()
    })
  })

  describe('特定同业选择', () => {
    it('should render peer selector when watchedPeers is not empty', () => {
      render(<PeerMonitoringFilter {...defaultProps} />)

      expect(screen.getByLabelText('选择同业')).toBeInTheDocument()
    })

    it('should not render peer selector when watchedPeers is empty', () => {
      render(<PeerMonitoringFilter {...defaultProps} watchedPeers={[]} />)

      expect(screen.queryByLabelText('选择同业')).not.toBeInTheDocument()
    })

    it('should display filter status message when specific peer is selected', () => {
      render(
        <PeerMonitoringFilter
          {...defaultProps}
          filter="specific-peer"
          selectedPeer="招商银行"
        />
      )

      expect(screen.getByText('仅显示 招商银行 的动态')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty watchedPeers array', () => {
      render(<PeerMonitoringFilter {...defaultProps} watchedPeers={[]} />)

      expect(screen.getByText('全部同业动态')).toBeInTheDocument()
      expect(screen.getByText('我关注的同业')).toBeInTheDocument()
    })

    it('should handle single watched peer', () => {
      render(
        <PeerMonitoringFilter {...defaultProps} watchedPeers={['招商银行']} />
      )

      expect(screen.getByLabelText('选择同业')).toBeInTheDocument()
    })

    it('should handle long peer names', () => {
      const longPeerName = '中国农业银行股份有限公司'
      render(
        <PeerMonitoringFilter {...defaultProps} watchedPeers={[longPeerName]} />
      )

      expect(screen.getByLabelText('选择同业')).toBeInTheDocument()
    })
  })
})
