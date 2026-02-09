/**
 * CrawlerHealthDashboard Component Tests
 *
 * Story 8.5: 爬虫健康度监控与告警
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { CrawlerHealthDashboard } from './CrawlerHealthDashboard'
import { CrawlerHealth } from '@/lib/api/peer-crawler-health'

describe('CrawlerHealthDashboard', () => {
  const mockHealth: CrawlerHealth = {
    overallStatus: 'healthy',
    sources: { total: 10, active: 8, inactive: 2 },
    recentTasks: { completed: 50, failed: 5, pending: 3 },
    last24h: { crawlCount: 20, successRate: 0.95, newContentCount: 18 },
  }

  describe('status display', () => {
    it('[P1] should display healthy status correctly', () => {
      // Arrange
      const health: CrawlerHealth = { ...mockHealth, overallStatus: 'healthy' }

      // Act
      render(<CrawlerHealthDashboard health={health} />)

      // Assert
      expect(screen.getByText('健康')).toBeInTheDocument()
      expect(screen.getByText('整体状态')).toBeInTheDocument()
    })

    it('[P1] should display warning status correctly', () => {
      // Arrange
      const health: CrawlerHealth = { ...mockHealth, overallStatus: 'warning' }

      // Act
      render(<CrawlerHealthDashboard health={health} />)

      // Assert
      expect(screen.getByText('警告')).toBeInTheDocument()
    })

    it('[P1] should display critical status correctly', () => {
      // Arrange
      const health: CrawlerHealth = { ...mockHealth, overallStatus: 'critical' }

      // Act
      render(<CrawlerHealthDashboard health={health} />)

      // Assert
      expect(screen.getByText('严重')).toBeInTheDocument()
    })
  })

  describe('sources stats', () => {
    it('[P1] should display source statistics', () => {
      // Act
      render(<CrawlerHealthDashboard health={mockHealth} />)

      // Assert
      expect(screen.getByText('采集源')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument() // total
      expect(screen.getByText(/8 活跃/)).toBeInTheDocument()
      expect(screen.getByText(/2 停用/)).toBeInTheDocument()
    })

    it('[P2] should handle zero sources', () => {
      // Arrange
      const health: CrawlerHealth = {
        ...mockHealth,
        sources: { total: 0, active: 0, inactive: 0 },
      }

      // Act
      render(<CrawlerHealthDashboard health={health} />)

      // Assert
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  describe('recent tasks stats', () => {
    it('[P1] should display task statistics', () => {
      // Act
      render(<CrawlerHealthDashboard health={mockHealth} />)

      // Assert
      expect(screen.getByText('最近任务')).toBeInTheDocument()
      expect(screen.getByText('58')).toBeInTheDocument() // 50 + 5 + 3
      expect(screen.getByText(/50 完成/)).toBeInTheDocument()
      expect(screen.getByText(/5 失败/)).toBeInTheDocument()
      expect(screen.getByText(/3 待执行/)).toBeInTheDocument()
    })
  })

  describe('24h stats', () => {
    it('[P1] should display 24h statistics', () => {
      // Act
      render(<CrawlerHealthDashboard health={mockHealth} />)

      // Assert
      expect(screen.getByText('24小时统计')).toBeInTheDocument()
      expect(screen.getByText('95.0%')).toBeInTheDocument() // success rate
      expect(screen.getByText(/20 次采集/)).toBeInTheDocument()
    })

    it('[P2] should format success rate with one decimal place', () => {
      // Arrange
      const health: CrawlerHealth = {
        ...mockHealth,
        last24h: { crawlCount: 15, successRate: 0.8667, newContentCount: 13 },
      }

      // Act
      render(<CrawlerHealthDashboard health={health} />)

      // Assert
      expect(screen.getByText('86.7%')).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('[P1] should display loading skeleton when loading', () => {
      // Act
      const { container } = render(<CrawlerHealthDashboard health={mockHealth} loading={true} />)

      // Assert
      const skeletonElements = container.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('[P1] should not display loading skeleton when not loading', () => {
      // Act
      const { container } = render(<CrawlerHealthDashboard health={mockHealth} loading={false} />)

      // Assert
      const skeletonElements = container.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBe(0)
    })
  })
})
