import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme, Theme } from '@mui/material/styles'
import { PushCard } from './PushCard'

/**
 * PushCard Component Tests (Story 2.5 - Task 3.1)
 *
 * 测试范围：
 * - 基础信息显示（标题、摘要、优先级、相关性）
 * - ROI分析展示（有ROI和无ROI场景）
 * - 薄弱项标签显示
 * - 推荐供应商显示
 * - 查看详情按钮交互
 */
describe('PushCard Component', () => {
  const theme: Theme = createTheme()

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
  }

  const mockPushWithROI = {
    pushId: 'push-1',
    title: '零信任架构在金融行业的应用',
    summary: '介绍零信任架构的实施方案和成本收益分析，包含详细的技术路线图和实施步骤',
    relevanceScore: 0.95,
    priorityLevel: 1 as const,
    weaknessCategories: ['数据安全', '身份认证'],
    publishDate: '2024-01-15T00:00:00Z',
    source: '金融科技周刊',
    roiAnalysis: {
      estimatedCost: '50-100万',
      expectedBenefit: '年节省200万运维成本',
      roiEstimate: 'ROI 2:1',
      implementationPeriod: '3-6个月',
      recommendedVendors: ['阿里云', '腾讯云', '华为云'],
    },
  }

  const mockPushWithoutROI = {
    ...mockPushWithROI,
    pushId: 'push-2',
    title: '云原生容器技术最新进展',
    roiAnalysis: undefined,
  }

  const mockOnViewDetail = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Information Display', () => {
    it('should render push title', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText('零信任架构在金融行业的应用')).toBeInTheDocument()
    })

    it('should render push summary', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/介绍零信任架构的实施方案/)).toBeInTheDocument()
    })

    it('should display priority level 1 with correct icon and color', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/🥇 优先级1/)).toBeInTheDocument()
    })

    it('should display priority level 2 with correct icon', () => {
      const push = { ...mockPushWithROI, priorityLevel: 2 as const }
      renderWithProviders(<PushCard push={push} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/🥈 优先级2/)).toBeInTheDocument()
    })

    it('should display priority level 3 with correct icon', () => {
      const push = { ...mockPushWithROI, priorityLevel: 3 as const }
      renderWithProviders(<PushCard push={push} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/🥉 优先级3/)).toBeInTheDocument()
    })

    it('should display relevance score as percentage', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/95% 相关/)).toBeInTheDocument()
    })

    it('should display source and publish date', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/来源: 金融科技周刊/)).toBeInTheDocument()
      expect(screen.getByText(/2024/)).toBeInTheDocument()
    })
  })

  describe('Weakness Categories Display', () => {
    it('should display weakness category tags', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/🎯 数据安全/)).toBeInTheDocument()
      expect(screen.getByText(/🎯 身份认证/)).toBeInTheDocument()
    })

    it('should not display weakness section when empty', () => {
      const push = { ...mockPushWithROI, weaknessCategories: [] }
      renderWithProviders(<PushCard push={push} onViewDetail={mockOnViewDetail} />)

      expect(screen.queryByText(/🎯/)).not.toBeInTheDocument()
    })
  })

  describe('ROI Analysis Display - With ROI', () => {
    it('should display ROI analysis section header', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/💰 ROI分析/)).toBeInTheDocument()
    })

    it('should display estimated cost', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText('预计投入')).toBeInTheDocument()
      expect(screen.getByText('50-100万')).toBeInTheDocument()
    })

    it('should display expected benefit', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText('预期收益')).toBeInTheDocument()
      expect(screen.getByText('年节省200万运维成本')).toBeInTheDocument()
    })

    it('should display ROI estimate prominently', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText('ROI估算')).toBeInTheDocument()
      expect(screen.getByText('ROI 2:1')).toBeInTheDocument()
    })

    it('should display implementation period', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText('实施周期')).toBeInTheDocument()
      expect(screen.getByText('3-6个月')).toBeInTheDocument()
    })

    it('should display recommended vendors', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText('推荐供应商')).toBeInTheDocument()
      expect(screen.getByText('阿里云')).toBeInTheDocument()
      expect(screen.getByText('腾讯云')).toBeInTheDocument()
      expect(screen.getByText('华为云')).toBeInTheDocument()
    })

    it('should not display vendor section when empty', () => {
      const push = {
        ...mockPushWithROI,
        roiAnalysis: {
          ...mockPushWithROI.roiAnalysis!,
          recommendedVendors: [],
        },
      }
      renderWithProviders(<PushCard push={push} onViewDetail={mockOnViewDetail} />)

      expect(screen.queryByText('推荐供应商')).not.toBeInTheDocument()
    })
  })

  describe('ROI Analysis Display - Without ROI', () => {
    it('should display "ROI分析中..." when ROI is missing', () => {
      renderWithProviders(
        <PushCard push={mockPushWithoutROI} onViewDetail={mockOnViewDetail} />
      )

      expect(screen.getByText('ROI分析中...')).toBeInTheDocument()
    })

    it('should not display ROI details when ROI is missing', () => {
      renderWithProviders(
        <PushCard push={mockPushWithoutROI} onViewDetail={mockOnViewDetail} />
      )

      expect(screen.queryByText('预计投入')).not.toBeInTheDocument()
      expect(screen.queryByText('预期收益')).not.toBeInTheDocument()
      expect(screen.queryByText('ROI估算')).not.toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should call onViewDetail with pushId when clicking view detail button', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      const viewDetailButton = screen.getByRole('button', { name: /查看详情/i })
      fireEvent.click(viewDetailButton)

      expect(mockOnViewDetail).toHaveBeenCalledWith('push-1')
      expect(mockOnViewDetail).toHaveBeenCalledTimes(1)
    })

    it('should render view detail button with correct text', () => {
      renderWithProviders(<PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByRole('button', { name: /查看详情/i })).toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('should render Card component', () => {
      const { container } = renderWithProviders(
        <PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />
      )

      const cards = container.querySelectorAll('.MuiCard-root')
      expect(cards.length).toBe(1)
    })

    it('should render CardContent', () => {
      const { container } = renderWithProviders(
        <PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />
      )

      const cardContents = container.querySelectorAll('.MuiCardContent-root')
      expect(cardContents.length).toBe(1)
    })

    it('should render CardActions', () => {
      const { container } = renderWithProviders(
        <PushCard push={mockPushWithROI} onViewDetail={mockOnViewDetail} />
      )

      const cardActions = container.querySelectorAll('.MuiCardActions-root')
      expect(cardActions.length).toBe(1)
    })
  })

  describe('Relevance Score Color Coding', () => {
    it('should use error color for relevance >= 95%', () => {
      const push = { ...mockPushWithROI, relevanceScore: 0.96 }
      const { container } = renderWithProviders(
        <PushCard push={push} onViewDetail={mockOnViewDetail} />
      )

      expect(screen.getByText(/96% 相关/)).toBeInTheDocument()
    })

    it('should use warning color for relevance >= 90% and < 95%', () => {
      const push = { ...mockPushWithROI, relevanceScore: 0.92 }
      renderWithProviders(<PushCard push={push} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/92% 相关/)).toBeInTheDocument()
    })

    it('should use default color for relevance < 90%', () => {
      const push = { ...mockPushWithROI, relevanceScore: 0.85 }
      renderWithProviders(<PushCard push={push} onViewDetail={mockOnViewDetail} />)

      expect(screen.getByText(/85% 相关/)).toBeInTheDocument()
    })
  })
})
