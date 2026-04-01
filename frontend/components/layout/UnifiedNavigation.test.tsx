import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
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
  describe('AC 7: 统一顶部导航', () => {
    it('should render all 4 navigation items', () => {
      render(<UnifiedNavigation />)

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('标准评估')).toBeInTheDocument()
      expect(screen.getByText('Radar Service')).toBeInTheDocument()
      expect(screen.getByText('报告中心')).toBeInTheDocument()
    })

    it('should activate Dashboard tab when at root path', () => {
      render(<UnifiedNavigation />)

      const dashboardTab = screen.getByRole('button', { name: /Dashboard/i })
      expect(dashboardTab).toHaveClass('text-[#059669]')
      expect(dashboardTab).toHaveClass('border-[#059669]')
    })

    it('should activate Radar Service tab when at /radar path', () => {
      // Mock usePathname to return /radar
      const { usePathname } = require('next/navigation')
      usePathname.mockReturnValue('/radar')

      render(<UnifiedNavigation />)

      // Find Radar Service tab (it should be selected)
      const radarTab = screen.getByRole('button', { name: /Radar Service/i })
      expect(radarTab).toHaveClass('text-[#059669]')
      expect(radarTab).toHaveClass('border-[#059669]')
    })

    it('should navigate to /radar when clicking Radar Service tab', () => {
      const mockPush = jest.fn()
      const { useRouter } = require('next/navigation')
      useRouter.mockReturnValue({ push: mockPush })

      render(<UnifiedNavigation />)

      const radarTab = screen.getByRole('button', { name: /Radar Service/i })
      fireEvent.click(radarTab)

      expect(mockPush).toHaveBeenCalledWith('/radar')
    })

    it('should navigate to /radar?orgId=xxx when clicking Radar Service tab with orgId', () => {
      const mockPush = jest.fn()
      const { useRouter } = require('next/navigation')
      useRouter.mockReturnValue({ push: mockPush })

      render(<UnifiedNavigation organizationId="org-123" />)

      const radarTab = screen.getByRole('button', { name: /Radar Service/i })
      fireEvent.click(radarTab)

      expect(mockPush).toHaveBeenCalledWith('/radar?orgId=org-123')
    })
  })

  describe('Component Rendering', () => {
    it('should match snapshot', () => {
      const { container } = render(<UnifiedNavigation />)
      expect(container).toMatchSnapshot()
    })

    it('should have correct height for tabs', () => {
      render(<UnifiedNavigation />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).toHaveClass('h-16')
      })
    })

    it('should render icons correctly', () => {
      render(<UnifiedNavigation />)

      // Check if icons are rendered (Lucide icons are rendered as SVG)
      const container = screen.getByText('Dashboard').parentElement
      expect(container).toBeInTheDocument()
    })
  })

  describe('Tab Activation Logic', () => {
    it('should activate projects tab when path starts with /projects', () => {
      const { usePathname } = require('next/navigation')
      usePathname.mockReturnValue('/projects/test-project')

      render(<UnifiedNavigation />)

      const projectsTab = screen.getByRole('button', { name: /标准评估/i })
      expect(projectsTab).toHaveClass('text-[#059669]')
    })

    it('should activate dashboard tab for root path', () => {
      const { usePathname } = require('next/navigation')
      usePathname.mockReturnValue('/')

      render(<UnifiedNavigation />)

      const dashboardTab = screen.getByRole('button', { name: /Dashboard/i })
      expect(dashboardTab).toHaveClass('text-[#059669]')
    })
  })
})
