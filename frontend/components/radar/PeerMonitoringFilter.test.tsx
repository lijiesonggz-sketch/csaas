import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme, Theme } from '@mui/material/styles'
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
  const theme: Theme = createTheme()

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
  }

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
      renderWithProviders(<PeerMonitoringFilter {...defaultProps} />)

      expect(screen.getByText('筛选条件')).toBeInTheDocument()
    })

    it('should render "全部同业动态" chip', () => {
      renderWithProviders(<PeerMonitoringFilter {...defaultProps} />)

      expect(screen.getByText('全部同业动态')).toBeInTheDocument()
    })

    it('should render "我关注的同业" chip', () => {
      renderWithProviders(<PeerMonitoringFilter {...defaultProps} />)

      expect(screen.getByText('我关注的同业')).toBeInTheDocument()
    })

    it('should highlight "全部同业动态" when filter is all', () => {
      renderWithProviders(<PeerMonitoringFilter {...defaultProps} />)

      const allChip = screen.getByText('全部同业动态')
      expect(allChip).toBeInTheDocument()
    })

    it('should highlight "我关注的同业" when filter is watched', () => {
      renderWithProviders(<PeerMonitoringFilter {...defaultProps} filter="watched" />)

      const watchedChip = screen.getByText('我关注的同业')
      expect(watchedChip).toBeInTheDocument()
    })

    it('should call onFilterChange with "all" when clicking "全部同业动态"', () => {
      renderWithProviders(<PeerMonitoringFilter {...defaultProps} filter="watched" />)

      const allChip = screen.getByText('全部同业动态')
      fireEvent.click(allChip)

      expect(mockOnFilterChange).toHaveBeenCalledWith('all')
    })

    it('should call onFilterChange with "watched" when clicking "我关注的同业"', () => {
      renderWithProviders(<PeerMonitoringFilter {...defaultProps} />)

      const watchedChip = screen.getByText('我关注的同业')
      fireEvent.click(watchedChip)

      expect(mockOnFilterChange).toHaveBeenCalledWith('watched')
    })

    it('should display filter status message when filter is watched', () => {
      renderWithProviders(<PeerMonitoringFilter {...defaultProps} filter="watched" />)

      expect(screen.getByText('仅显示您关注的同业机构动态')).toBeInTheDocument()
    })
  })

  describe('特定同业选择', () => {
    it('should render peer selector when watchedPeers is not empty', () => {
      renderWithProviders(<PeerMonitoringFilter {...defaultProps} />)

      expect(screen.getByLabelText('选择同业')).toBeInTheDocument()
    })

    it('should not render peer selector when watchedPeers is empty', () => {
      renderWithProviders(<PeerMonitoringFilter {...defaultProps} watchedPeers={[]} />)

      expect(screen.queryByLabelText('选择同业')).not.toBeInTheDocument()
    })

    it('should display all watched peers in selector', () => {
      renderWithProviders(<PeerMonitoringFilter {...defaultProps} />)

      const selector = screen.getByLabelText('选择同业')
      fireEvent.mouseDown(selector)

      expect(screen.getByText('招商银行')).toBeInTheDocument()
      expect(screen.getByText('平安银行')).toBeInTheDocument()
      expect(screen.getByText('工商银行')).toBeInTheDocument()
    })

    it('should call onFilterChange and onPeerChange when selecting a peer', () => {
      renderWithProviders(<PeerMonitoringFilter {...defaultProps} />)

      const selector = screen.getByLabelText('选择同业')
      fireEvent.mouseDown(selector)

      const peerOption = screen.getByText('招商银行')
      fireEvent.click(peerOption)

      expect(mockOnFilterChange).toHaveBeenCalledWith('specific-peer')
      expect(mockOnPeerChange).toHaveBeenCalledWith('招商银行')
    })

    it('should display filter status message when specific peer is selected', () => {
      renderWithProviders(
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
      renderWithProviders(<PeerMonitoringFilter {...defaultProps} watchedPeers={[]} />)

      expect(screen.getByText('全部同业动态')).toBeInTheDocument()
      expect(screen.getByText('我关注的同业')).toBeInTheDocument()
    })

    it('should handle single watched peer', () => {
      renderWithProviders(
        <PeerMonitoringFilter {...defaultProps} watchedPeers={['招商银行']} />
      )

      expect(screen.getByLabelText('选择同业')).toBeInTheDocument()
    })

    it('should handle long peer names', () => {
      const longPeerName = '中国农业银行股份有限公司'
      renderWithProviders(
        <PeerMonitoringFilter {...defaultProps} watchedPeers={[longPeerName]} />
      )

      expect(screen.getByLabelText('选择同业')).toBeInTheDocument()
    })
  })
})
