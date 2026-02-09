import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'
import { PeerCrawlerSourceList } from './PeerCrawlerSourceList'
import { RadarSource } from '@/lib/api/radar-sources'

/**
 * PeerCrawlerSourceList Component Tests
 *
 * Story 8.1: 同业采集源管理列表
 */
describe('PeerCrawlerSourceList Component', () => {
  const theme = createTheme()

  const renderWithTheme = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
  }

  const mockSources: RadarSource[] = [
    {
      id: 'source-1',
      source: '杭州银行金融科技',
      category: 'industry',
      url: 'https://tech.hzbank.com',
      type: 'website',
      peerName: '杭州银行',
      isActive: true,
      crawlSchedule: '0 */6 * * *',
      lastCrawledAt: '2026-02-07T10:00:00Z',
      lastCrawlStatus: 'success',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-02-07T10:00:00Z',
    },
    {
      id: 'source-2',
      source: '宁波银行招聘',
      category: 'industry',
      url: 'https://recruit.nbcb.com',
      type: 'recruitment',
      peerName: '宁波银行',
      isActive: false,
      crawlSchedule: '0 3 * * *',
      lastCrawledAt: '2026-02-06T15:00:00Z',
      lastCrawlStatus: 'failed',
      lastCrawlError: 'Connection timeout',
      createdAt: '2026-01-15T00:00:00Z',
      updatedAt: '2026-02-06T15:00:00Z',
    },
    {
      id: 'source-3',
      source: '招商银行公众号',
      category: 'industry',
      url: 'https://mp.weixin.qq.com/cmb',
      type: 'wechat',
      isActive: true,
      crawlSchedule: '0 */12 * * *',
      lastCrawlStatus: 'pending',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
    },
  ]

  const mockHandlers = {
    onEdit: jest.fn(),
    onCreate: jest.fn(),
    onDelete: jest.fn(),
    onToggleActive: jest.fn(),
    onTestCrawl: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock window.confirm
    Object.defineProperty(window, 'confirm', {
      writable: true,
      value: jest.fn(),
    })
  })

  describe('Loading State', () => {
    it('should show loading spinner when loading is true', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={[]}
          loading={true}
          {...mockHandlers}
        />
      )

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should not show table when loading', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={[]}
          loading={true}
          {...mockHandlers}
        />
      )

      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('should show error alert when error is provided', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={[]}
          error="Failed to load sources"
          {...mockHandlers}
        />
      )

      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load sources')
    })
  })

  describe('Empty State', () => {
    it('should show info alert when no sources', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={[]}
          {...mockHandlers}
        />
      )

      expect(screen.getByRole('alert')).toHaveTextContent('暂无采集源配置')
    })

    it('should show add button in empty state', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={[]}
          {...mockHandlers}
        />
      )

      expect(screen.getByRole('button', { name: /添加采集源/i })).toBeInTheDocument()
    })
  })

  describe('List Display', () => {
    it('should render table with sources', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getByText('杭州银行金融科技')).toBeInTheDocument()
      expect(screen.getByText('宁波银行招聘')).toBeInTheDocument()
      expect(screen.getByText('招商银行公众号')).toBeInTheDocument()
    })

    it('should display source count in header', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      expect(screen.getByText(/采集源列表/)).toBeInTheDocument()
      expect(screen.getByText(/3 个/)).toBeInTheDocument()
    })

    it('should display type labels correctly', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      expect(screen.getByText('官网')).toBeInTheDocument()
      expect(screen.getByText('招聘')).toBeInTheDocument()
      expect(screen.getByText('公众号')).toBeInTheDocument()
    })

    it('should display status labels correctly', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      expect(screen.getByText('成功')).toBeInTheDocument()
      expect(screen.getByText('失败')).toBeInTheDocument()
      expect(screen.getByText('待采集')).toBeInTheDocument()
    })

    it('should display peerName as subtitle when available', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      expect(screen.getByText('杭州银行')).toBeInTheDocument()
      expect(screen.getByText('宁波银行')).toBeInTheDocument()
    })

    it('should display last crawl time formatted', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      // Should show formatted dates - use getAllByText since there are multiple dates
      const dates = screen.getAllByText(/2026/)
      expect(dates.length).toBeGreaterThanOrEqual(1)
    })

    it('should show "从未采集" for sources without crawl time', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      expect(screen.getByText('从未采集')).toBeInTheDocument()
    })

    it('should display error message for failed sources', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      expect(screen.getByText('Connection timeout')).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should call onCreate when add button clicked', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      const addButton = screen.getByRole('button', { name: /添加采集源/i })
      fireEvent.click(addButton)

      expect(mockHandlers.onCreate).toHaveBeenCalledTimes(1)
    })

    it('should call onEdit when edit button clicked', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      const editButtons = screen.getAllByRole('button', { name: /编辑/i })
      fireEvent.click(editButtons[0])

      expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockSources[0])
    })

    it('should call onDelete when delete confirmed', async () => {
      ;(window.confirm as jest.Mock).mockReturnValue(true)
      mockHandlers.onDelete.mockResolvedValue(undefined)

      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      const deleteButtons = screen.getAllByRole('button', { name: /删除/i })
      fireEvent.click(deleteButtons[0])

      expect(window.confirm).toHaveBeenCalledWith('确定要删除这个采集源吗？')
      await waitFor(() => {
        expect(mockHandlers.onDelete).toHaveBeenCalledWith('source-1')
      })
    })

    it('should not call onDelete when delete cancelled', () => {
      ;(window.confirm as jest.Mock).mockReturnValue(false)

      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      const deleteButtons = screen.getAllByRole('button', { name: /删除/i })
      fireEvent.click(deleteButtons[0])

      expect(window.confirm).toHaveBeenCalled()
      expect(mockHandlers.onDelete).not.toHaveBeenCalled()
    })

    it('should call onToggleActive when switch toggled', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      // Find switches by their CSS class since MUI Switch doesn't always have checkbox role
      const switches = document.querySelectorAll('.MuiSwitch-root input')
      expect(switches.length).toBeGreaterThan(0)
      fireEvent.click(switches[0])

      expect(mockHandlers.onToggleActive).toHaveBeenCalledWith('source-1')
    })

    it('should call onTestCrawl when test button clicked', async () => {
      mockHandlers.onTestCrawl.mockResolvedValue(undefined)

      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      const testButtons = screen.getAllByRole('button', { name: /测试采集/i })
      fireEvent.click(testButtons[0])

      await waitFor(() => {
        expect(mockHandlers.onTestCrawl).toHaveBeenCalledWith(mockSources[0])
      })
    })

    it('should disable test button while testing', async () => {
      mockHandlers.onTestCrawl.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      const testButtons = screen.getAllByRole('button', { name: /测试采集/i })
      fireEvent.click(testButtons[0])

      // Button should be disabled during testing
      expect(testButtons[0]).toBeDisabled()

      // Wait for the operation to complete
      await waitFor(() => {
        expect(testButtons[0]).not.toBeDisabled()
      }, { timeout: 200 })
    })

    it('should disable delete button while deleting', async () => {
      ;(window.confirm as jest.Mock).mockReturnValue(true)
      mockHandlers.onDelete.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      const deleteButtons = screen.getAllByRole('button', { name: /删除/i })
      fireEvent.click(deleteButtons[0])

      // Button should be disabled during deletion
      await waitFor(() => {
        expect(deleteButtons[0]).toBeDisabled()
      })
    })
  })

  describe('Switch States', () => {
    it('should show switch as checked for active sources', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      // Find switches by their CSS class
      const switches = document.querySelectorAll('.MuiSwitch-root input')
      expect(switches.length).toBe(3)
      expect(switches[0]).toBeChecked() // source-1 is active
      expect(switches[1]).not.toBeChecked() // source-2 is inactive
      expect(switches[2]).toBeChecked() // source-3 is active
    })
  })

  describe('URL Display', () => {
    it('should truncate long URLs', () => {
      renderWithTheme(
        <PeerCrawlerSourceList
          sources={mockSources}
          {...mockHandlers}
        />
      )

      // URLs should be displayed (even if truncated)
      mockSources.forEach(source => {
        const urlElements = screen.getAllByText(source.url)
        expect(urlElements.length).toBeGreaterThan(0)
      })
    })
  })
})
