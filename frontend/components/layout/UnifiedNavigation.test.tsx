import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme, Theme } from '@mui/material/styles'
import UnifiedNavigation from './UnifiedNavigation'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    pathname: '/',
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(() => null),
  })),
}))

describe('UnifiedNavigation Component', () => {
  const theme: Theme = createTheme()

  const renderWithProviders = (component: React.ReactElement, orgId?: string) => {
    return render(
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>,
    )
  }

  describe('AC 7: 统一顶部导航', () => {
    it('should render all 4 navigation items', () => {
      renderWithProviders(<UnifiedNavigation />)

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('标准评估')).toBeInTheDocument()
      expect(screen.getByText('Radar Service')).toBeInTheDocument()
      expect(screen.getByText('报告中心')).toBeInTheDocument()
    })

    it('should activate Dashboard tab when at root path', () => {
      renderWithProviders(<UnifiedNavigation />)

      const dashboardTab = screen.getByRole('tab', { name: /Dashboard/i })
      expect(dashboardTab).toHaveClass('Mui-selected')
    })

    it('should activate Radar Service tab when at /radar path', () => {
      // Mock usePathname to return /radar
      const { usePathname } = require('next/navigation')
      usePathname.mockReturnValue('/radar')

      renderWithProviders(<UnifiedNavigation />)

      // Find Radar Service tab (it should be selected)
      const tabs = screen.getAllByRole('tab')
      const radarTab = tabs.find((tab) => tab.textContent?.includes('Radar Service'))
      expect(radarTab).toHaveClass('Mui-selected')
    })

    it('should navigate to /radar when clicking Radar Service tab', () => {
      const mockPush = jest.fn()
      const { useRouter } = require('next/navigation')
      useRouter.mockReturnValue({ push: mockPush })

      renderWithProviders(<UnifiedNavigation />)

      const radarTab = screen.getByRole('tab', { name: /Radar Service/i })
      fireEvent.click(radarTab)

      expect(mockPush).toHaveBeenCalledWith('/radar')
    })

    it('should navigate to /radar?orgId=xxx when clicking Radar Service tab with orgId', () => {
      const mockPush = jest.fn()
      const { useRouter } = require('next/navigation')
      useRouter.mockReturnValue({ push: mockPush })

      renderWithProviders(<UnifiedNavigation organizationId="org-123" />)

      const radarTab = screen.getByRole('tab', { name: /Radar Service/i })
      fireEvent.click(radarTab)

      expect(mockPush).toHaveBeenCalledWith('/radar?orgId=org-123')
    })
  })

  describe('Component Rendering', () => {
    it('should match snapshot', () => {
      const { container } = renderWithProviders(<UnifiedNavigation />)
      expect(container).toMatchSnapshot()
    })

    it('should have correct minHeight for tabs', () => {
      renderWithProviders(<UnifiedNavigation />)

      const tabs = screen.getAllByRole('tab')
      tabs.forEach((tab) => {
        expect(tab).toHaveStyle({ minHeight: '64px' })
      })
    })
  })
})
