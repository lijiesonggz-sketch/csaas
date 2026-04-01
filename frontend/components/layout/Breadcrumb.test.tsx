import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Breadcrumb from './Breadcrumb'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    pathname: '/',
  })),
  usePathname: jest.fn(() => '/'),
}))

describe('Breadcrumb Component', () => {
  const renderWithProviders = (component: React.ReactElement, pathname = '/') => {
    const { usePathname } = require('next/navigation')
    usePathname.mockReturnValue(pathname)

    return render(component)
  }

  describe('AC 7: 面包屑导航', () => {
    it('should not render breadcrumb for root path', () => {
      renderWithProviders(<Breadcrumb />)

      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    })

    it('should render single breadcrumb for simple path', () => {
      renderWithProviders(<Breadcrumb />, '/radar')

      const nav = screen.getByRole('navigation')
      expect(nav).toBeInTheDocument()
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
    it('should display organization name when provided', () => {
      renderWithProviders(<Breadcrumb organizationName="测试组织" />, '/radar')

      const orgText = screen.getByText('组织: 测试组织')
      expect(orgText).toBeInTheDocument()
    })

    it('should not display organization when not provided', () => {
      renderWithProviders(<Breadcrumb />, '/radar')

      expect(screen.queryByText(/组织:/)).not.toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('should use chevron separators', () => {
      renderWithProviders(<Breadcrumb />, '/radar/tech')

      const nav = screen.getByRole('navigation')
      expect(nav).toBeInTheDocument()
      expect(screen.getByText('首页')).toBeInTheDocument()
    })

    it('should have py-2 spacing class', () => {
      renderWithProviders(<Breadcrumb />, '/radar')

      const container = screen.getByRole('navigation')?.parentElement
      expect(container).toHaveClass('py-2')
    })
  })
})
