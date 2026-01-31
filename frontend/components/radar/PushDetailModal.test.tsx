import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme, Theme } from '@mui/material/styles'
import { PushDetailModal } from './PushDetailModal'
import { getRadarPush, markPushAsRead, RadarPush } from '@/lib/api/radar'

// Mock dependencies
jest.mock('@/lib/api/radar')

/**
 * PushDetailModal Component Tests (Story 2.5 - Task 3.1)
 *
 * 测试范围：
 * - 详情加载和显示
 * - 完整ROI分析展示
 * - 标记已读功能
 * - 错误处理
 * - 操作按钮交互
 */
describe('PushDetailModal Component', () => {
  const theme: Theme = createTheme()

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
  }

  const mockPushWithROI: RadarPush = {
    pushId: 'push-1',
    radarType: 'tech',
    title: '零信任架构在金融行业的应用',
    summary: '介绍零信任架构的实施方案和成本收益分析',
    fullContent:
      '零信任架构(Zero Trust Architecture)是一种现代化的网络安全模型，它假设网络内外的所有流量都是不可信的...',
    relevanceScore: 0.95,
    priorityLevel: 1,
    weaknessCategories: ['数据安全', '身份认证'],
    url: 'https://example.com/article',
    publishDate: '2024-01-15T00:00:00Z',
    source: '金融科技周刊',
    tags: ['零信任', '安全架构'],
    targetAudience: 'IT总监',
    roiAnalysis: {
      estimatedCost: '50-100万',
      expectedBenefit: '年节省200万运维成本',
      roiEstimate: 'ROI 2:1',
      implementationPeriod: '3-6个月',
      recommendedVendors: ['阿里云', '腾讯云', '华为云'],
    },
    isRead: false,
  }

  const mockPushWithoutROI: RadarPush = {
    ...mockPushWithROI,
    pushId: 'push-2',
    roiAnalysis: undefined,
  }

  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getRadarPush as jest.Mock).mockResolvedValue(mockPushWithROI)
    ;(markPushAsRead as jest.Mock).mockResolvedValue(undefined)
  })

  describe('Modal Opening and Loading', () => {
    it('should load push details when modal opens', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(getRadarPush).toHaveBeenCalledWith('push-1')
      })
    })

    it('should show loading state while fetching', () => {
      ;(getRadarPush as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      )

      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should not load push when modal is closed', () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={false} onClose={mockOnClose} />
      )

      expect(getRadarPush).not.toHaveBeenCalled()
    })
  })

  describe('Content Display', () => {
    it('should display push title and metadata', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('零信任架构在金融行业的应用')).toBeInTheDocument()
        expect(screen.getByText('金融科技周刊')).toBeInTheDocument()
        expect(screen.getByText(/2024/)).toBeInTheDocument()
      })
    })

    it('should display weakness categories', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText(/关联薄弱项: 数据安全/)).toBeInTheDocument()
        expect(screen.getByText(/关联薄弱项: 身份认证/)).toBeInTheDocument()
      })
    })

    it('should display full content', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText(/零信任架构\(Zero Trust Architecture\)/)).toBeInTheDocument()
      })
    })

    it('should fall back to summary when fullContent is missing', async () => {
      const pushWithoutFullContent = {
        ...mockPushWithROI,
        fullContent: undefined,
      }
      ;(getRadarPush as jest.Mock).mockResolvedValue(pushWithoutFullContent)

      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText(/介绍零信任架构的实施方案/)).toBeInTheDocument()
      })
    })
  })

  describe('ROI Analysis Display', () => {
    it('should display ROI analysis section header', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText(/💰 投资回报率\(ROI\)分析/)).toBeInTheDocument()
      })
    })

    it('should display estimated cost with explanation', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('预计投入成本')).toBeInTheDocument()
        expect(screen.getByText('50-100万')).toBeInTheDocument()
        expect(screen.getByText('包含软硬件采购、实施服务、培训等')).toBeInTheDocument()
      })
    })

    it('should display expected benefit with explanation', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('预期收益')).toBeInTheDocument()
        expect(screen.getByText('年节省200万运维成本')).toBeInTheDocument()
        expect(screen.getByText('量化收益包含成本节省、风险规避等')).toBeInTheDocument()
      })
    })

    it('should display ROI estimate with formula', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('ROI估算')).toBeInTheDocument()
        expect(screen.getByText('ROI 2:1')).toBeInTheDocument()
        expect(screen.getByText('计算公式：')).toBeInTheDocument()
        expect(
          screen.getByText('ROI = (预期收益 - 投入成本) / 投入成本')
        ).toBeInTheDocument()
      })
    })

    it('should display implementation period', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('实施周期')).toBeInTheDocument()
        expect(screen.getByText('3-6个月')).toBeInTheDocument()
        expect(screen.getByText('从启动到上线的预计时间')).toBeInTheDocument()
      })
    })

    it('should display recommended vendors with context', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('推荐供应商')).toBeInTheDocument()
        expect(screen.getByText('阿里云')).toBeInTheDocument()
        expect(screen.getByText('腾讯云')).toBeInTheDocument()
        expect(screen.getByText('华为云')).toBeInTheDocument()
        expect(screen.getByText('以上供应商具有金融行业资质和成功案例')).toBeInTheDocument()
      })
    })

    it('should not display ROI section when roiAnalysis is missing', async () => {
      ;(getRadarPush as jest.Mock).mockResolvedValue(mockPushWithoutROI)

      renderWithProviders(
        <PushDetailModal pushId="push-2" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.queryByText(/💰 投资回报率\(ROI\)分析/)).not.toBeInTheDocument()
        expect(screen.queryByText('预计投入成本')).not.toBeInTheDocument()
      })
    })
  })

  describe('Mark as Read Functionality', () => {
    it('should display "标记为已读" button when push is unread', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /标记为已读/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /标记为已读/i })).not.toBeDisabled()
      })
    })

    it('should call markPushAsRead when clicking button', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('零信任架构在金融行业的应用')).toBeInTheDocument()
      })

      const markAsReadButton = screen.getByRole('button', { name: /标记为已读/i })
      fireEvent.click(markAsReadButton)

      await waitFor(() => {
        expect(markPushAsRead).toHaveBeenCalledWith('push-1')
      })
    })

    it('should update button to "已读" after marking as read', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('零信任架构在金融行业的应用')).toBeInTheDocument()
      })

      const markAsReadButton = screen.getByRole('button', { name: /标记为已读/i })
      fireEvent.click(markAsReadButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /已读/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /已读/i })).toBeDisabled()
      })
    })

    it('should display disabled "已读" button when push is already read', async () => {
      const readPush = { ...mockPushWithROI, isRead: true }
      ;(getRadarPush as jest.Mock).mockResolvedValue(readPush)

      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /已读/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /已读/i })).toBeDisabled()
      })
    })
  })

  describe('Action Buttons', () => {
    it('should display bookmark button', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /收藏/i })).toBeInTheDocument()
      })
    })

    it('should display share button', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /分享/i })).toBeInTheDocument()
      })
    })

    it('should display original link button when url exists', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        const originalLinkButton = screen.getByRole('link', { name: /查看原文/i })
        expect(originalLinkButton).toBeInTheDocument()
        expect(originalLinkButton).toHaveAttribute('href', 'https://example.com/article')
        expect(originalLinkButton).toHaveAttribute('target', '_blank')
      })
    })

    it('should display close button and call onClose when clicked', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('零信任架构在金融行业的应用')).toBeInTheDocument()
      })

      const closeButton = screen.getByRole('button', { name: /关闭/i })
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    it('should display error message when API fails', async () => {
      const errorMessage = '网络连接失败'
      ;(getRadarPush as jest.Mock).mockRejectedValue(new Error(errorMessage))

      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('should display close button in error state', async () => {
      ;(getRadarPush as jest.Mock).mockRejectedValue(new Error('API Error'))

      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /关闭/i })).toBeInTheDocument()
      })

      const closeButton = screen.getByRole('button', { name: /关闭/i })
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should handle markPushAsRead failure gracefully', async () => {
      ;(markPushAsRead as jest.Mock).mockRejectedValue(new Error('Mark as read failed'))

      // 设置为开发环境以启用 console.error
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('零信任架构在金融行业的应用')).toBeInTheDocument()
      })

      const markAsReadButton = screen.getByRole('button', { name: /标记为已读/i })
      fireEvent.click(markAsReadButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to mark as read:',
          expect.any(Error)
        )
      })

      consoleSpy.mockRestore()
      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Dialog Structure', () => {
    it('should render dialog when open', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('零信任架构在金融行业的应用')).toBeInTheDocument()
      })

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should render DialogTitle', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        const dialogTitle = screen.getByText('零信任架构在金融行业的应用')
        expect(dialogTitle.closest('[class*="MuiDialogTitle"]')).toBeInTheDocument()
      })
    })

    it('should render DialogContent and DialogActions', async () => {
      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('零信任架构在金融行业的应用')).toBeInTheDocument()
      })

      // Verify dialog structure by checking for key elements
      expect(screen.getByRole('button', { name: /收藏/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /分享/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /关闭/i })).toBeInTheDocument()
    })
  })

  describe('Industry Radar Layout (Story 3.3)', () => {
    const mockIndustryPush: RadarPush = {
      pushId: 'industry-1',
      radarType: 'industry',
      title: '某银行云原生转型实践案例',
      summary: '该银行通过云原生架构升级，实现了系统性能和稳定性的显著提升',
      fullContent: '完整的实践描述内容...',
      relevanceScore: 0.92,
      priorityLevel: 1,
      weaknessCategories: ['系统架构'],
      url: 'https://example.com/industry-case',
      publishDate: '2024-01-15T00:00:00Z',
      source: '银行业技术论坛',
      tags: ['云原生', '容器化', '微服务', 'DevOps'],
      targetAudience: 'IT总监',
      peerName: '招商银行',
      practiceDescription: '该银行采用Kubernetes容器编排平台，实现了应用的快速部署和弹性伸缩。通过引入服务网格 Istio，提升了微服务治理能力。同时，构建了完整的CI/CD流水线，实现了自动化测试和部署。',
      estimatedCost: '300-500万',
      implementationPeriod: '6-12个月',
      technicalEffect: '系统可用性提升至99.99%，部署效率提升80%',
      isRead: false,
    }

    beforeEach(() => {
      jest.clearAllMocks()
      ;(getRadarPush as jest.Mock).mockResolvedValue(mockIndustryPush)
    })

    it('should display peer name with icon', async () => {
      renderWithProviders(
        <PushDetailModal pushId="industry-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('招商银行')).toBeInTheDocument()
      })
    })

    it('should display "同业标杆机构" tag', async () => {
      renderWithProviders(
        <PushDetailModal pushId="industry-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('同业标杆机构')).toBeInTheDocument()
      })
    })

    it('should display practice description', async () => {
      renderWithProviders(
        <PushDetailModal pushId="industry-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('技术实践详细描述')).toBeInTheDocument()
        expect(screen.getByText(/该银行采用Kubernetes容器编排平台/)).toBeInTheDocument()
      })
    })

    it('should display estimated cost', async () => {
      renderWithProviders(
        <PushDetailModal pushId="industry-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('投入成本')).toBeInTheDocument()
        expect(screen.getByText('300-500万')).toBeInTheDocument()
        expect(screen.getByText('包含软硬件采购、实施服务等')).toBeInTheDocument()
      })
    })

    it('should display implementation period', async () => {
      renderWithProviders(
        <PushDetailModal pushId="industry-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('实施周期')).toBeInTheDocument()
        expect(screen.getByText('6-12个月')).toBeInTheDocument()
        expect(screen.getByText('从启动到上线的预计时间')).toBeInTheDocument()
      })
    })

    it('should display technical effect', async () => {
      renderWithProviders(
        <PushDetailModal pushId="industry-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('技术效果')).toBeInTheDocument()
        expect(screen.getByText('系统可用性提升至99.99%，部署效率提升80%')).toBeInTheDocument()
      })
    })

    it('should display key learnings from tags', async () => {
      renderWithProviders(
        <PushDetailModal pushId="industry-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('可借鉴点总结')).toBeInTheDocument()
        expect(screen.getByText(/云原生、容器化、微服务、DevOps/)).toBeInTheDocument()
      })
    })

    it('should not display ROI analysis for industry radar', async () => {
      renderWithProviders(
        <PushDetailModal pushId="industry-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.queryByText(/💰 投资回报率\(ROI\)分析/)).not.toBeInTheDocument()
        expect(screen.queryByText('预期收益')).not.toBeInTheDocument()
        expect(screen.queryByText('推荐供应商')).not.toBeInTheDocument()
      })
    })

    it('should handle missing peerName gracefully', async () => {
      const pushWithoutPeer = { ...mockIndustryPush, peerName: undefined }
      ;(getRadarPush as jest.Mock).mockResolvedValue(pushWithoutPeer)

      renderWithProviders(
        <PushDetailModal pushId="industry-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('某银行云原生转型实践案例')).toBeInTheDocument()
      })

      // Should not show peer name section
      expect(screen.queryByText('招商银行')).not.toBeInTheDocument()
    })

    it('should handle missing practiceDescription gracefully', async () => {
      const pushWithoutDescription = { ...mockIndustryPush, practiceDescription: undefined }
      ;(getRadarPush as jest.Mock).mockResolvedValue(pushWithoutDescription)

      renderWithProviders(
        <PushDetailModal pushId="industry-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('某银行云原生转型实践案例')).toBeInTheDocument()
      })

      // Should not show practice description section
      expect(screen.queryByText('技术实践详细描述')).not.toBeInTheDocument()
    })

    it('should not display tech radar layout when radarType is industry', async () => {
      renderWithProviders(
        <PushDetailModal pushId="industry-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText('某银行云原生转型实践案例')).toBeInTheDocument()
      })

      // Industry radar should not display tech radar fields
      expect(screen.queryByText(/ROI估算/)).not.toBeInTheDocument()
      expect(screen.queryByText('计算公式：')).not.toBeInTheDocument()
    })

    it('should display tech radar layout when radarType is tech', async () => {
      ;(getRadarPush as jest.Mock).mockResolvedValue(mockPushWithROI)

      renderWithProviders(
        <PushDetailModal pushId="push-1" isOpen={true} onClose={mockOnClose} />
      )

      await waitFor(() => {
        expect(screen.getByText(/💰 投资回报率\(ROI\)分析/)).toBeInTheDocument()
      })

      // Tech radar should display ROI analysis
      expect(screen.getByText('ROI估算')).toBeInTheDocument()
      expect(screen.getByText('计算公式：')).toBeInTheDocument()

      // Should not display industry radar fields
      expect(screen.queryByText('同业标杆机构')).not.toBeInTheDocument()
      expect(screen.queryByText('技术实践详细描述')).not.toBeInTheDocument()
    })
  })
})
