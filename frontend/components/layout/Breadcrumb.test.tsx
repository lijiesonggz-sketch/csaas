import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme, Theme } from '@mui/material/styles'
import Breadcrumb from './Breadcrumb'
import { NavigateNextIcon } from '@mui/icons-material/NavigateNext'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    pathname: '/',
  })),
  usePathname: jest.fn(() => '/'),
}))

describe('Breadcrumb Component', () => {
  const theme: Theme = createTheme()

  const renderWithProviders = (component: React.ReactElement, pathname = '/') => {
    const { usePathname } = require('next/navigation')
    usePathname.mockReturnValue(pathname)

    return render(
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>,
    )
  }

  describe('AC 7: 面包屑导航', () => {
    it('should not render breadcrumb for root path', () => {
      renderWithProviders(<Breadcrumb />)

      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    })

    it('should render single breadcrumb for simple path', () => {
      renderWithProviders(<Breadcrumb />, '/radar')

      const breadcrumbs = screen.getAllByRole('listitem')
      expect(breadcrumbs.length).toBeGreaterThan(0)
      expect(screen.getByText('Radar Service')).toBeInTheDocument()
    })

    it('should render full breadcrumb path for radar tech page', () => {
      renderWithProviders(<Breadcrumb />, '/radar/tech')

      expect(screen.getByText('首页')).toBeInTheDocument()
      expect(screen.getByText('Radar Service')).toBeInTheDocument()
      expect(screen.getByText('技术雷达')).toBeInTheDocument()
    })

    it('should render full breadcrumb path for radar industry page', () => {
      renderWithProviders(<Breadcrumb />, '/radar/industry')

      expect(screen.getByText('首页')).toBeInTheDocument()
      expect(screen.getByText('Radar Service')).toBeInTheDocument()
      expect(screen.getByText('行业雷达')).toBeInTheDocument()
    })

    it('should render full breadcrumb path for radar compliance page', () => {
      renderWithProviders(<Breadcrumb />, '/radar/compliance')

      expect(screen.getByText('首页')).toBeInTheDocument()
      expect(screen.getByText('Radar Service')).toBeInTheDocument()
      expect(screen.getByText('合规雷达')).toBeInTheDocument()
    })

    it('should navigate when clicking breadcrumb link', () => {
      const mockPush = jest.fn()
      const { useRouter } = require('next/navigation')
      useRouter.mockReturnValue({ push: mockPush })

      renderWithProviders(<Breadcrumb />, '/radar/tech')

      const homeLink = screen.getByText('首页')
      fireEvent.click(homeLink)

      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  describe('Path Mapping', () => {
    it('should map /projects to "标准评估"', () => {
      renderWithProviders(<Breadcrumb />, '/projects/test-project')

      expect(screen.getByText('标准评估')).toBeInTheDocument()
    })

    it('should map /radar to "Radar Service"', () => {
      renderWithProviders(<Breadcrumb />, '/radar')

      expect(screen.getByText('Radar Service')).toBeInTheDocument()
    })

    it('should map /radar/tech to "技术雷达"', () => {
      renderWithProviders(<Breadcrumb />, '/radar/tech')

      expect(screen.getByText('技术雷达')).toBeInTheDocument()
    })

    it('should map /radar/industry to "行业雷达"', () => {
      renderWithProviders(<Breadcrumb />, '/radar/industry')

      expect(screen.getByText('行业雷达')).toBeInTheDocument()
    })

    it('should map /radar/compliance to "合规雷达"', () => {
      renderWithProviders(<Breadcrumb />, '/radar/compliance')

      expect(screen.getByText('合规雷达')).toBeInTheDocument()
    })
  })

  describe('Organization Name Display', () => {
    it('should display organization name Chip when provided', () => {
      renderWithProviders(<Breadcrumb organizationName="测试组织" />, '/radar')

      const chip = screen.getByText('组织: 测试组织')
      expect(chip).toBeInTheDocument()
    })

    it('should not display organization Chip when not provided', () => {
      renderWithProviders(<Breadcrumb />, '/radar')

      expect(screen.queryByText(/组织:/)).not.toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('should use NavigateNextIcon as separator', () => {
      renderWithProviders(<Breadcrumb />, '/radar/tech')

      const separators = screen.getAllByTestId('NavigateNextIcon')
      expect(separators.length).toBeGreaterThan(0)
    })

    it('should have py-2 spacing', () => {
      renderWithProviders(<Breadcrumb />, '/radar')

      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('MuiBox-root')
      expect(nav).toHaveStyle({ py: 2 })
    })
  })
})
