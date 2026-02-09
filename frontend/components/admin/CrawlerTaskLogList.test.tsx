/**
 * CrawlerTaskLogList Component Tests
 *
 * Story 8.5: 爬虫健康度监控与告警
 */

import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { CrawlerTaskLogList } from './CrawlerTaskLogList'
import { CrawlerTask } from '@/lib/api/peer-crawler-health'

describe('CrawlerTaskLogList', () => {
  const mockTasks: CrawlerTask[] = [
    {
      id: 'task-1',
      sourceId: 'source-1',
      peerName: 'Test Corp',
      tenantId: 'tenant-1',
      sourceType: 'website',
      targetUrl: 'https://example.com',
      status: 'completed',
      crawlResult: { title: 'Test' },
      rawContentId: 'raw-1',
      retryCount: 0,
      errorMessage: null,
      startedAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T10:05:00Z',
      createdAt: '2024-01-15T09:55:00Z',
    },
    {
      id: 'task-2',
      sourceId: 'source-2',
      peerName: 'Another Corp',
      tenantId: 'tenant-1',
      sourceType: 'wechat',
      targetUrl: 'https://wechat.example.com',
      status: 'failed',
      crawlResult: null,
      rawContentId: null,
      retryCount: 3,
      errorMessage: 'Connection timeout',
      startedAt: '2024-01-15T11:00:00Z',
      completedAt: null,
      createdAt: '2024-01-15T10:55:00Z',
    },
    {
      id: 'task-3',
      sourceId: 'source-3',
      peerName: 'Pending Corp',
      tenantId: 'tenant-1',
      sourceType: 'recruitment',
      targetUrl: 'https://jobs.example.com',
      status: 'pending',
      crawlResult: null,
      rawContentId: null,
      retryCount: 0,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: '2024-01-15T12:00:00Z',
    },
  ]

  const defaultProps = {
    tasks: mockTasks,
    total: 3,
    loading: false,
    page: 1,
    pageSize: 20,
  }

  describe('rendering', () => {
    it('[P1] should render task list with correct headers', () => {
      // Act
      render(<CrawlerTaskLogList {...defaultProps} />)

      // Assert - use getAllByText for elements that appear in both filter and table header
      const statusElements = screen.getAllByText('状态')
      expect(statusElements.length).toBeGreaterThanOrEqual(1)
      const peerNameElements = screen.getAllByText('同业名称')
      expect(peerNameElements.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('类型')).toBeInTheDocument()
      expect(screen.getByText('目标URL')).toBeInTheDocument()
      expect(screen.getByText('重试次数')).toBeInTheDocument()
      expect(screen.getByText('创建时间')).toBeInTheDocument()
    })

    it('[P1] should render task data correctly', () => {
      // Act
      render(<CrawlerTaskLogList {...defaultProps} />)

      // Assert
      expect(screen.getByText('Test Corp')).toBeInTheDocument()
      expect(screen.getByText('Another Corp')).toBeInTheDocument()
      expect(screen.getByText('website')).toBeInTheDocument()
      expect(screen.getByText('wechat')).toBeInTheDocument()
    })

    it('[P1] should display status badges correctly', () => {
      // Act
      render(<CrawlerTaskLogList {...defaultProps} />)

      // Assert - get status badges within the table (not the filter dropdown)
      const table = screen.getByRole('table')
      const statusBadges = within(table).getAllByText('已完成')
      expect(statusBadges.length).toBeGreaterThanOrEqual(1)
      expect(within(table).getByText('失败')).toBeInTheDocument()
      expect(within(table).getByText('待执行')).toBeInTheDocument()
    })

    it('[P2] should render empty state when no tasks', () => {
      // Act
      render(<CrawlerTaskLogList {...defaultProps} tasks={[]} total={0} />)

      // Assert
      expect(screen.getByText('暂无任务记录')).toBeInTheDocument()
    })
  })

  describe('filtering', () => {
    it('[P1] should call onFilterChange when status filter changes', () => {
      // Arrange
      const onFilterChange = jest.fn()
      render(<CrawlerTaskLogList {...defaultProps} onFilterChange={onFilterChange} />)

      // Act - use the select element directly
      const statusSelect = screen.getByRole('combobox')
      fireEvent.change(statusSelect, { target: { value: 'failed' } })

      // Assert
      expect(onFilterChange).toHaveBeenCalledWith({ status: 'failed', peerName: undefined })
    })

    it('[P1] should call onFilterChange when search button is clicked', () => {
      // Arrange
      const onFilterChange = jest.fn()
      render(<CrawlerTaskLogList {...defaultProps} onFilterChange={onFilterChange} />)

      // Act
      const searchInput = screen.getByPlaceholderText('搜索同业名称')
      fireEvent.change(searchInput, { target: { value: 'Test Corp' } })

      const searchButton = screen.getByText('搜索')
      fireEvent.click(searchButton)

      // Assert
      expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ peerName: 'Test Corp' }))
    })

    it('[P2] should clear peerName filter when empty search is submitted', () => {
      // Arrange
      const onFilterChange = jest.fn()
      render(<CrawlerTaskLogList {...defaultProps} onFilterChange={onFilterChange} />)

      // Act
      const searchButton = screen.getByText('搜索')
      fireEvent.click(searchButton)

      // Assert
      expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ peerName: undefined }))
    })
  })

  describe('pagination', () => {
    it('[P1] should display pagination when total exceeds pageSize', () => {
      // Arrange
      const props = { ...defaultProps, total: 50, pageSize: 20 }

      // Act
      render(<CrawlerTaskLogList {...props} />)

      // Assert
      expect(screen.getByText(/第 1 \/ 3 页/)).toBeInTheDocument()
    })

    it('[P1] should not display pagination when total is less than pageSize', () => {
      // Arrange
      const props = { ...defaultProps, total: 10, pageSize: 20 }

      // Act
      render(<CrawlerTaskLogList {...props} />)

      // Assert
      expect(screen.queryByText(/第/)).not.toBeInTheDocument()
    })

    it('[P1] should call onPageChange when next page is clicked', () => {
      // Arrange
      const onPageChange = jest.fn()
      const props = { ...defaultProps, total: 50, pageSize: 20, onPageChange }

      // Act
      render(<CrawlerTaskLogList {...props} />)

      // Find the next page button by looking for buttons with chevron icons
      const allButtons = screen.getAllByRole('button')
      // The next page button should be the second button (after the prev button)
      const nextButton = allButtons[allButtons.length - 1]
      fireEvent.click(nextButton)

      // Assert
      expect(onPageChange).toHaveBeenCalledWith(2)
    })

    it('[P2] should disable previous button on first page', () => {
      // Arrange
      const props = { ...defaultProps, total: 50, pageSize: 20, page: 1 }

      // Act
      render(<CrawlerTaskLogList {...props} />)

      // Get pagination buttons specifically (exclude the search button)
      const paginationSection = screen.getByText(/第 1 \/ 3 页/).parentElement
      const pageButtons = within(paginationSection!).getAllByRole('button')
      const prevButton = pageButtons[0]

      // Assert
      expect(prevButton).toBeDisabled()
    })

    it('[P2] should disable next button on last page', () => {
      // Arrange
      const props = { ...defaultProps, total: 50, pageSize: 20, page: 3 }

      // Act
      render(<CrawlerTaskLogList {...props} />)

      // Get pagination buttons specifically (exclude the search button)
      const paginationSection = screen.getByText(/第 3 \/ 3 页/).parentElement
      const pageButtons = within(paginationSection!).getAllByRole('button')
      const nextButton = pageButtons[pageButtons.length - 1]

      // Assert
      expect(nextButton).toBeDisabled()
    })
  })

  describe('loading state', () => {
    it('[P1] should display loading skeleton when loading', () => {
      // Act
      const { container } = render(<CrawlerTaskLogList {...defaultProps} loading={true} />)

      // Assert
      const skeletonElements = container.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('[P1] should not display table when loading', () => {
      // Act
      render(<CrawlerTaskLogList {...defaultProps} loading={true} />)

      // Assert
      expect(screen.queryByText('Test Corp')).not.toBeInTheDocument()
    })
  })

  describe('URL links', () => {
    it('[P2] should render target URL as clickable link', () => {
      // Act
      render(<CrawlerTaskLogList {...defaultProps} />)

      // Assert
      const link = screen.getByText('https://example.com')
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', 'https://example.com')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })
})
