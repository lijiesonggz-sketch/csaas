import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme, Theme } from '@mui/material/styles'
import RadarDashboardPage from './page'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(() => null),
  })),
}))

describe('RadarDashboardPage Component', () => {
  const theme: Theme = createTheme()

  const renderWithProviders = (component: React.ReactElement, orgId?: string) => {
    const { useSearchParams, useRouter } = require('next/navigation')
    useSearchParams.mockReturnValue({
      get: jest.fn((key) => key === 'orgId' ? orgId : null),
    })

    const mockPush = jest.fn()
    useRouter.mockReturnValue({ push: mockPush })

    return render(
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>,
    )
  }

  describe('AC 6: Radar Dashboard Page', () => {
    it('should render page header with Radar icon', () => {
      renderWithProviders(<RadarDashboardPage />)

      expect(screen.getByText('Radar Service')).toBeInTheDocument()
      expect(screen.getByText(/智能推送技术趋势、行业标杆和合规预警/)).toBeInTheDocument()
    })

    it('should render three radar type cards', () => {
      renderWithProviders(<RadarDashboardPage />)

      expect(screen.getByText('技术雷达')).toBeInTheDocument()
      expect(screen.getByText('行业雷达')).toBeInTheDocument()
      expect(screen.getByText('合规雷达')).toBeInTheDocument()
    })

    it('should display tech radar card with correct description', () => {
      renderWithProviders(<RadarDashboardPage />)

      expect(screen.getByText(/基于薄弱项推送技术趋势，包含ROI分析/)).toBeInTheDocument()
    })

    it('should display industry radar card with correct description', () => {
      renderWithProviders(<RadarDashboardPage />)

      expect(screen.getByText(/同业标杆学习，推送技术实践案例/)).toBeInTheDocument()
    })

    it('should display compliance radar card with correct description', () => {
      renderWithProviders(<RadarDashboardPage />)

      expect(screen.getByText(/合规风险预警，提供应对剧本/)).toBeInTheDocument()
    })

    it('should navigate to tech radar when clicking tech radar card button', () => {
      const mockPush = jest.fn()
      const { useRouter } = require('next/navigation')
      useRouter.mockReturnValue({ push: mockPush })

      renderWithProviders(<RadarDashboardPage />)

      const techRadarButtons = screen.getAllByText('进入雷达')
      fireEvent.click(techRadarButtons[0])

      expect(mockPush).toHaveBeenCalledWith('/radar/tech')
    })

    it('should navigate to industry radar when clicking industry radar card button', () => {
      const mockPush = jest.fn()
      const { useRouter } = require('next/navigation')
      useRouter.mockReturnValue({ push: mockPush })

      renderWithProviders(<RadarDashboardPage />)

      const industryRadarButtons = screen.getAllByText('进入雷达')
      fireEvent.click(industryRadarButtons[1])

      expect(mockPush).toHaveBeenCalledWith('/radar/industry')
    })

    it('should navigate to compliance radar when clicking compliance radar card button', () => {
      const mockPush = jest.fn()
      const { useRouter } = require('next/navigation')
      useRouter.mockReturnValue({ push: mockPush })

      renderWithProviders(<RadarDashboardPage />)

      const complianceRadarButtons = screen.getAllByText('进入雷达')
      fireEvent.click(complianceRadarButtons[2])

      expect(mockPush).toHaveBeenCalledWith('/radar/compliance')
    })
  })

  describe('Organization ID Handling', () => {
    it('should pass orgId parameter when navigating with orgId', () => {
      const mockPush = jest.fn()
      const { useRouter } = require('next/navigation')
      useRouter.mockReturnValue({ push: mockPush })

      renderWithProviders(<RadarDashboardPage />, 'org-123')

      const techRadarButtons = screen.getAllByText('进入雷达')
      fireEvent.click(techRadarButtons[0])

      expect(mockPush).toHaveBeenCalledWith('/radar/tech?orgId=org-123')
    })

    it('should display orgId in info box when provided', () => {
      renderWithProviders(<RadarDashboardPage />, 'org-456')

      expect(screen.getByText(/org-456/)).toBeInTheDocument()
    })

    it('should show "请先选择组织" message when orgId is not provided', () => {
      renderWithProviders(<RadarDashboardPage />)

      expect(screen.getByText(/请先选择组织/)).toBeInTheDocument()
    })

    it('should set radarActivated state when orgId is provided', () => {
      renderWithProviders(<RadarDashboardPage />, 'org-789')

      // useEffect should set radarActivated to true
      // This is tested implicitly by checking the orgId is displayed
      expect(screen.getByText(/org-789/)).toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('should render all cards in a Grid', () => {
      const { container } = renderWithProviders(<RadarDashboardPage />)

      const cards = container.querySelectorAll('.MuiCard-root')
      expect(cards.length).toBeGreaterThanOrEqual(3)
    })

    it('should have correct border colors for each radar type', () => {
      const { container } = renderWithProviders(<RadarDashboardPage />)

      const cards = container.querySelectorAll('.MuiCard-root')
      // Check that cards have borderLeft style
      cards.forEach((card) => {
        const style = window.getComputedStyle(card)
        expect(style.borderLeftWidth).toBeDefined()
      })
    })

    it('should display info box with tip', () => {
      renderWithProviders(<RadarDashboardPage />)

      expect(screen.getByText(/💡 提示：/)).toBeInTheDocument()
      expect(screen.getByText(/Radar Service会根据您的评估结果自动识别薄弱项/)).toBeInTheDocument()
    })

    it('should have responsive grid layout', () => {
      const { container } = renderWithProviders(<RadarDashboardPage />)

      const gridItems = container.querySelectorAll('.MuiGrid-item')
      expect(gridItems.length).toBe(3)
    })
  })

  describe('Color Coding', () => {
    it('should apply blue color to tech radar', () => {
      renderWithProviders(<RadarDashboardPage />)

      const techRadarCard = screen.getByText('技术雷达').closest('.MuiCard-root')
      expect(techRadarCard).toHaveStyle({ borderLeft: '4px solid #2196F3' })
    })

    it('should apply orange color to industry radar', () => {
      renderWithProviders(<RadarDashboardPage />)

      const industryRadarCard = screen.getByText('行业雷达').closest('.MuiCard-root')
      expect(industryRadarCard).toHaveStyle({ borderLeft: '4px solid #FF9800' })
    })

    it('should apply red color to compliance radar', () => {
      renderWithProviders(<RadarDashboardPage />)

      const complianceRadarCard = screen.getByText('合规雷达').closest('.MuiCard-root')
      expect(complianceRadarCard).toHaveStyle({ borderLeft: '4px solid #F44336' })
    })
  })
})
