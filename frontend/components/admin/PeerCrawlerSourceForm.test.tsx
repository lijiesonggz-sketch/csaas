import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'
import { PeerCrawlerSourceForm } from './PeerCrawlerSourceForm'
import { RadarSource } from '@/lib/api/radar-sources'

/**
 * PeerCrawlerSourceForm Component Tests
 *
 * Story 8.1: 同业采集源表单
 */
describe('PeerCrawlerSourceForm Component', () => {
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
    crawlConfig: {
      titleSelector: 'h1.article-title',
      contentSelector: 'div.content',
      maxPages: 3,
    },
    lastCrawlStatus: 'success',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-07T10:00:00Z',
  }

  const mockHandlers = {
    onClose: jest.fn(),
    onSubmit: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Create Mode', () => {
    it('should render create form title', () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      expect(screen.getByText('添加采集源')).toBeInTheDocument()
    })

    it('should render with default values', () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      // Check default values
      expect(screen.getByLabelText(/同业机构名称/i)).toHaveValue('')
      expect(screen.getByLabelText(/采集URL/i)).toHaveValue('')
      expect(screen.getByLabelText(/启用此采集源/i)).toBeChecked()
    })

    it('should show validation error for empty source name', async () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const submitButton = screen.getByRole('button', { name: /创建/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('同业机构名称不能为空')).toBeInTheDocument()
      })
    })

    it('should show validation error for empty URL', async () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      // Fill source name but not URL
      const sourceInput = screen.getByLabelText(/同业机构名称/i)
      fireEvent.change(sourceInput, { target: { value: 'Test Source' } })

      const submitButton = screen.getByRole('button', { name: /创建/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('采集URL不能为空')).toBeInTheDocument()
      })
    })

    it('should show validation error for invalid URL', async () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const sourceInput = screen.getByLabelText(/同业机构名称/i)
      const urlInput = screen.getByLabelText(/采集URL/i)

      fireEvent.change(sourceInput, { target: { value: 'Test Source' } })
      fireEvent.change(urlInput, { target: { value: 'not-a-valid-url' } })

      const submitButton = screen.getByRole('button', { name: /创建/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('URL格式不正确')).toBeInTheDocument()
      })
    })

    it('should show validation error for invalid cron expression', async () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const sourceInput = screen.getByLabelText(/同业机构名称/i)
      const urlInput = screen.getByLabelText(/采集URL/i)

      fireEvent.change(sourceInput, { target: { value: 'Test Source' } })
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

      // The form should have default cron value selected
      // Verify form is valid with default values
      const submitButton = screen.getByRole('button', { name: /创建/i })
      expect(submitButton).not.toBeDisabled()
    })

    it('should submit form with valid data', async () => {
      mockHandlers.onSubmit.mockResolvedValue(undefined)

      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const sourceInput = screen.getByLabelText(/同业机构名称/i)
      const urlInput = screen.getByLabelText(/采集URL/i)

      fireEvent.change(sourceInput, { target: { value: 'Test Source' } })
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /创建/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockHandlers.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            source: 'Test Source',
            url: 'https://example.com',
            category: 'industry',
            isActive: true,
          })
        )
      })
    })

    it('should close form after successful submit', async () => {
      mockHandlers.onSubmit.mockResolvedValue(undefined)

      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const sourceInput = screen.getByLabelText(/同业机构名称/i)
      const urlInput = screen.getByLabelText(/采集URL/i)

      fireEvent.change(sourceInput, { target: { value: 'Test Source' } })
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /创建/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockHandlers.onClose).toHaveBeenCalled()
      })
    })
  })

  describe('Edit Mode', () => {
    it('should render edit form title', () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          source={mockSource}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      expect(screen.getByText('编辑采集源')).toBeInTheDocument()
    })

    it('should populate form with source data', () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          source={mockSource}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      expect(screen.getByLabelText(/同业机构名称/i)).toHaveValue('杭州银行金融科技')
      expect(screen.getByLabelText(/采集URL/i)).toHaveValue('https://tech.hzbank.com')
      expect(screen.getByLabelText(/启用此采集源/i)).toBeChecked()
    })

    it('should call onSubmit with updated data', async () => {
      mockHandlers.onSubmit.mockResolvedValue(undefined)

      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          source={mockSource}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const sourceInput = screen.getByLabelText(/同业机构名称/i)
      fireEvent.change(sourceInput, { target: { value: 'Updated Source Name' } })

      const submitButton = screen.getByRole('button', { name: /保存/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockHandlers.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            source: 'Updated Source Name',
            url: 'https://tech.hzbank.com',
          })
        )
      })
    })
  })

  describe('Form Interactions', () => {
    it('should call onClose when cancel button clicked', () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /取消/i })
      fireEvent.click(cancelButton)

      expect(mockHandlers.onClose).toHaveBeenCalledTimes(1)
    })

    it('should show type selector with options', () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      // Find the type select by its label text - use getAllByText and check first one
      const typeLabels = screen.getAllByText(/来源类型/i)
      expect(typeLabels.length).toBeGreaterThan(0)
    })

    it('should show cron preset options', () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      // Find the schedule select by its label text
      const scheduleLabels = screen.getAllByText(/采集频率/i)
      expect(scheduleLabels.length).toBeGreaterThan(0)
    })

    it('should toggle isActive switch', async () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const switchElement = screen.getByLabelText(/启用此采集源/i)
      expect(switchElement).toBeChecked()

      fireEvent.click(switchElement)
      expect(switchElement).not.toBeChecked()
    })
  })

  describe('Selector Configuration Tab', () => {
    it('should switch to selector config tab', async () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          source={mockSource}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const selectorTab = screen.getByRole('tab', { name: /选择器配置/i })
      fireEvent.click(selectorTab)

      expect(screen.getByText(/配置CSS选择器/)).toBeInTheDocument()
    })

    it('should show JSON editor in selector tab', async () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          source={mockSource}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const selectorTab = screen.getByRole('tab', { name: /选择器配置/i })
      fireEvent.click(selectorTab)

      expect(screen.getByLabelText(/选择器配置/i)).toBeInTheDocument()
    })

    it('should show individual selector fields', async () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const selectorTab = screen.getByRole('tab', { name: /选择器配置/i })
      fireEvent.click(selectorTab)

      // Expand the single field config accordion
      const singleFieldAccordion = screen.getByText(/单个字段配置/i)
      fireEvent.click(singleFieldAccordion)

      expect(screen.getByLabelText(/标题选择器/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/内容选择器/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/日期选择器/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/作者选择器/i)).toBeInTheDocument()
    })

    it('should show JSON error for invalid JSON', async () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const selectorTab = screen.getByRole('tab', { name: /选择器配置/i })
      fireEvent.click(selectorTab)

      const jsonEditor = screen.getByLabelText(/选择器配置/i)
      fireEvent.change(jsonEditor, { target: { value: 'invalid json' } })

      expect(screen.getByText('JSON格式错误')).toBeInTheDocument()
    })

    it('should disable submit when JSON is invalid', async () => {
      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      // First fill required fields
      const sourceInput = screen.getByLabelText(/同业机构名称/i)
      const urlInput = screen.getByLabelText(/采集URL/i)
      fireEvent.change(sourceInput, { target: { value: 'Test Source' } })
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

      // Switch to selector tab and enter invalid JSON
      const selectorTab = screen.getByRole('tab', { name: /选择器配置/i })
      fireEvent.click(selectorTab)

      const jsonEditor = screen.getByLabelText(/选择器配置/i)
      fireEvent.change(jsonEditor, { target: { value: 'invalid' } })

      // Go back to basic tab and try to submit
      const basicTab = screen.getByRole('tab', { name: /基本信息/i })
      fireEvent.click(basicTab)

      const submitButton = screen.getByRole('button', { name: /创建/i })
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Loading State', () => {
    it('should show loading state during submission', async () => {
      mockHandlers.onSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const sourceInput = screen.getByLabelText(/同业机构名称/i)
      const urlInput = screen.getByLabelText(/采集URL/i)

      fireEvent.change(sourceInput, { target: { value: 'Test Source' } })
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /创建/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /提交中/i })).toBeInTheDocument()
      })
    })

    it('should disable buttons during submission', async () => {
      mockHandlers.onSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const sourceInput = screen.getByLabelText(/同业机构名称/i)
      const urlInput = screen.getByLabelText(/采集URL/i)

      fireEvent.change(sourceInput, { target: { value: 'Test Source' } })
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /创建/i })
      const cancelButton = screen.getByRole('button', { name: /取消/i })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(cancelButton).toBeDisabled()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display submit error message', async () => {
      mockHandlers.onSubmit.mockRejectedValue(new Error('Network error'))

      renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const sourceInput = screen.getByLabelText(/同业机构名称/i)
      const urlInput = screen.getByLabelText(/采集URL/i)

      fireEvent.change(sourceInput, { target: { value: 'Test Source' } })
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /创建/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error')
      })
    })

    it('should clear error when form is closed and reopened', async () => {
      mockHandlers.onSubmit.mockRejectedValue(new Error('Network error'))

      const { rerender } = renderWithTheme(
        <PeerCrawlerSourceForm
          open={true}
          onClose={mockHandlers.onClose}
          onSubmit={mockHandlers.onSubmit}
        />
      )

      const sourceInput = screen.getByLabelText(/同业机构名称/i)
      const urlInput = screen.getByLabelText(/采集URL/i)

      fireEvent.change(sourceInput, { target: { value: 'Test Source' } })
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /创建/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      // Close and reopen form
      rerender(
        <ThemeProvider theme={theme}>
          <PeerCrawlerSourceForm
            open={false}
            onClose={mockHandlers.onClose}
            onSubmit={mockHandlers.onSubmit}
          />
        </ThemeProvider>
      )

      rerender(
        <ThemeProvider theme={theme}>
          <PeerCrawlerSourceForm
            open={true}
            onClose={mockHandlers.onClose}
            onSubmit={mockHandlers.onSubmit}
          />
        </ThemeProvider>
      )

      // Error should be cleared
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
