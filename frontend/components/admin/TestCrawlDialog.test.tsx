import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'
import { TestCrawlDialog } from './TestCrawlDialog'
import { RadarSource } from '@/lib/api/radar-sources'

/**
 * TestCrawlDialog Component Tests
 *
 * Story 8.1: 测试采集结果展示
 */
describe('TestCrawlDialog Component', () => {
  const theme = createTheme()

  const renderWithTheme = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
  }

  const mockSource: RadarSource = {
    id: 'source-1',
    source: '杭州银行金融科技',
    category: 'industry',
    url: 'https://tech.hzbank.com',
    type: 'website',
    peerName: '杭州银行',
    isActive: true,
    crawlSchedule: '0 */6 * * *',
    lastCrawlStatus: 'pending',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-07T10:00:00Z',
  }

  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Loading State', () => {
    it('should show loading spinner when result is null', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={null}
          onClose={mockOnClose}
        />
      )

      // There are two progressbars (one in title, one in content)
      const progressbars = screen.getAllByRole('progressbar')
      expect(progressbars.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('正在采集，请稍候...')).toBeInTheDocument()
    })

    it('should show "取消" button when loading', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={null}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
    })

    it('should display source name in title', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={null}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText(/测试采集 - 杭州银行金融科技/)).toBeInTheDocument()
    })
  })

  describe('Success State', () => {
    const mockSuccessResult = {
      success: true,
      result: {
        title: 'Test Article Title',
        summary: 'This is a test summary of the article.',
        contentPreview: 'This is the content preview. It contains the first 500 characters of the article content.',
        url: 'https://tech.hzbank.com/article/123',
        publishDate: '2026-02-07T10:30:00Z',
        author: 'Test Author',
        duration: 1234,
      },
    }

    it('should show success icon and title', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockSuccessResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('采集成功')).toBeInTheDocument()
    })

    it('should display title when available', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockSuccessResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('标题')).toBeInTheDocument()
      expect(screen.getByText('Test Article Title')).toBeInTheDocument()
    })

    it('should display author when available', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockSuccessResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('作者')).toBeInTheDocument()
      expect(screen.getByText('Test Author')).toBeInTheDocument()
    })

    it('should display publish date when available', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockSuccessResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('发布日期')).toBeInTheDocument()
      expect(screen.getByText(/2026/)).toBeInTheDocument()
    })

    it('should display summary when available', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockSuccessResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('摘要')).toBeInTheDocument()
      expect(screen.getByText('This is a test summary of the article.')).toBeInTheDocument()
    })

    it('should display content preview', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockSuccessResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('正文预览（前500字）')).toBeInTheDocument()
      expect(screen.getByText(/This is the content preview/)).toBeInTheDocument()
    })

    it('should display URL with link', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockSuccessResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('采集URL')).toBeInTheDocument()
      const link = screen.getByText('https://tech.hzbank.com/article/123')
      expect(link).toHaveAttribute('href', 'https://tech.hzbank.com/article/123')
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('should display duration', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockSuccessResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText(/耗时: 1234ms/)).toBeInTheDocument()
    })

    it('should show info alert about test data', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockSuccessResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText(/测试采集的内容不会保存到数据库/)).toBeInTheDocument()
    })

    it('should show "关闭" button when success', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockSuccessResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()
    })

    it('should call onClose when close button clicked', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockSuccessResult}
          onClose={mockOnClose}
        />
      )

      const closeButton = screen.getByRole('button', { name: '关闭' })
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Failure State', () => {
    const mockFailureResult = {
      success: false,
      error: 'Connection timeout: Failed to fetch content from the URL',
    }

    it('should show error icon and title', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockFailureResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('采集失败')).toBeInTheDocument()
    })

    it('should display error message', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockFailureResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Connection timeout: Failed to fetch content from the URL')).toBeInTheDocument()
    })

    it('should show error alert', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockFailureResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByRole('alert')).toHaveTextContent('采集失败')
    })

    it('should show "关闭" button when failed', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockFailureResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()
    })

    it('should not show success-specific fields when failed', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={mockFailureResult}
          onClose={mockOnClose}
        />
      )

      expect(screen.queryByText('标题')).not.toBeInTheDocument()
      expect(screen.queryByText('摘要')).not.toBeInTheDocument()
      expect(screen.queryByText('正文预览')).not.toBeInTheDocument()
    })
  })

  describe('Partial Success Data', () => {
    it('should handle missing optional fields gracefully', () => {
      const partialResult = {
        success: true,
        result: {
          title: 'Test Title',
          contentPreview: 'Test content',
          url: 'https://example.com',
          duration: 500,
          // Missing: summary, author, publishDate
        },
      }

      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={partialResult}
          onClose={mockOnClose}
        />
      )

      // Should show title and content
      expect(screen.getByText('Test Title')).toBeInTheDocument()
      expect(screen.getByText('Test content')).toBeInTheDocument()

      // Should not show missing fields
      expect(screen.queryByText('作者')).not.toBeInTheDocument()
      expect(screen.queryByText('发布日期')).not.toBeInTheDocument()
      expect(screen.queryByText('摘要')).not.toBeInTheDocument()
    })

    it('should use source URL when result URL is not available', () => {
      const resultWithoutUrl = {
        success: true,
        result: {
          title: 'Test Title',
          contentPreview: 'Test content',
          duration: 500,
          // Missing URL
        },
      }

      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={resultWithoutUrl}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('https://tech.hzbank.com')).toHaveAttribute(
        'href',
        'https://tech.hzbank.com'
      )
    })
  })

  describe('Dialog State', () => {
    it('should not render when open is false', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={false}
          source={mockSource}
          result={null}
          onClose={mockOnClose}
        />
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should render when open is true', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={null}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should handle null source gracefully', () => {
      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={null}
          result={null}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText(/测试采集 -/)).toBeInTheDocument()
    })
  })

  describe('Date Formatting', () => {
    it('should format publish date correctly', () => {
      const resultWithDate = {
        success: true,
        result: {
          title: 'Test Title',
          contentPreview: 'Test content',
          url: 'https://example.com',
          publishDate: '2026-02-07T15:30:00.000Z',
          duration: 500,
        },
      }

      renderWithTheme(
        <TestCrawlDialog
          open={true}
          source={mockSource}
          result={resultWithDate}
          onClose={mockOnClose}
        />
      )

      // Should show formatted date (format depends on locale)
      const dateElement = screen.getByText(/2026/)
      expect(dateElement).toBeInTheDocument()
    })
  })
})
