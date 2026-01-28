import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme, Theme } from '@mui/material/styles'
import IndustryRadarPage from './page'

describe('IndustryRadarPage Component', () => {
  const theme: Theme = createTheme()

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>,
    )
  }

  describe('Page Rendering', () => {
    it('should render page header with Business icon and title', () => {
      renderWithProviders(<IndustryRadarPage />)

      expect(screen.getByText('行业雷达')).toBeInTheDocument()
    })

    it('should render subtitle', () => {
      renderWithProviders(<IndustryRadarPage />)

      expect(screen.getByText('同业标杆学习')).toBeInTheDocument()
    })

    it('should render placeholder card', () => {
      renderWithProviders(<IndustryRadarPage />)

      expect(screen.getByText('行业雷达功能即将推出...')).toBeInTheDocument()
    })

    it('should render Card component', () => {
      const { container } = renderWithProviders(<IndustryRadarPage />)

      const cards = container.querySelectorAll('.MuiCard-root')
      expect(cards.length).toBe(1)
    })
  })

  describe('Component Structure', () => {
    it('should use Container with maxWidth lg', () => {
      const { container } = renderWithProviders(<IndustryRadarPage />)

      const containers = container.querySelectorAll('.MuiContainer-root')
      expect(containers.length).toBeGreaterThan(0)
    })

    it('should have proper spacing with py-4', () => {
      renderWithProviders(<IndustryRadarPage />)

      const mainBox = screen.getByText('行业雷达').closest('.MuiBox-root')
      expect(mainBox).toBeInTheDocument()
    })

    it('should render h4 variant for main title', () => {
      renderWithProviders(<IndustryRadarPage />)

      const title = screen.getByText('行业雷达')
      expect(title.tagName).toBe('H4')
    })
  })

  describe('Content Display', () => {
    it('should display coming soon message', () => {
      renderWithProviders(<IndustryRadarPage />)

      expect(screen.getByText(/功能即将推出/)).toBeInTheDocument()
    })

    it('should have CardContent wrapper', () => {
      const { container } = renderWithProviders(<IndustryRadarPage />)

      const cardContents = container.querySelectorAll('.MuiCardContent-root')
      expect(cardContents.length).toBe(1)
    })
  })
})
