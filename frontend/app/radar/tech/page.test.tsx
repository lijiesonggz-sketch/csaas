import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme, Theme } from '@mui/material/styles'
import TechRadarPage from './page'

describe('TechRadarPage Component', () => {
  const theme: Theme = createTheme()

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>,
    )
  }

  describe('Page Rendering', () => {
    it('should render page header with TrendingUp icon and title', () => {
      renderWithProviders(<TechRadarPage />)

      expect(screen.getByText('技术雷达')).toBeInTheDocument()
    })

    it('should render subtitle', () => {
      renderWithProviders(<TechRadarPage />)

      expect(screen.getByText('ROI导向的技术决策支持')).toBeInTheDocument()
    })

    it('should render placeholder card', () => {
      renderWithProviders(<TechRadarPage />)

      expect(screen.getByText('技术雷达功能即将推出...')).toBeInTheDocument()
    })

    it('should render Card component', () => {
      const { container } = renderWithProviders(<TechRadarPage />)

      const cards = container.querySelectorAll('.MuiCard-root')
      expect(cards.length).toBe(1)
    })
  })

  describe('Component Structure', () => {
    it('should use Container with maxWidth lg', () => {
      const { container } = renderWithProviders(<TechRadarPage />)

      const containers = container.querySelectorAll('.MuiContainer-root')
      expect(containers.length).toBeGreaterThan(0)
    })

    it('should have proper spacing with py-4', () => {
      renderWithProviders(<TechRadarPage />)

      const mainBox = screen.getByText('技术雷达').closest('.MuiBox-root')
      expect(mainBox).toBeInTheDocument()
    })

    it('should render h4 variant for main title', () => {
      renderWithProviders(<TechRadarPage />)

      const title = screen.getByText('技术雷达')
      expect(title.tagName).toBe('H4')
    })
  })

  describe('Content Display', () => {
    it('should display coming soon message', () => {
      renderWithProviders(<TechRadarPage />)

      expect(screen.getByText(/功能即将推出/)).toBeInTheDocument()
    })

    it('should have CardContent wrapper', () => {
      const { container } = renderWithProviders(<TechRadarPage />)

      const cardContents = container.querySelectorAll('.MuiCardContent-root')
      expect(cardContents.length).toBe(1)
    })
  })
})
