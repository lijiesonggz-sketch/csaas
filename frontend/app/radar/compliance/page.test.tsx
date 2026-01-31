/**
 * ComplianceRadarPage Unit Tests
 *
 * Story 4.3 - Phase 7 Task 7.1
 *
 * 测试覆盖:
 * - 页面基础渲染
 * - 骨架屏显示
 * - 空状态显示
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'
import { useWebSocket } from '@/lib/hooks/useWebSocket'
import ComplianceRadarPage from './page'

// Mock dependencies
jest.mock('@/lib/api/radar')
jest.mock('@/lib/hooks/useWebSocket')

// Mock zustand store properly
const mockOrgStore = {
  currentOrganization: { id: 'org-1', name: '测试银行' },
  organizations: [{ id: 'org-1', name: '测试银行' }],
  weaknesses: [],
  fetchOrganizations: jest.fn().mockResolvedValue([]),
  setCurrentOrganization: jest.fn(),
  getState: () => mockOrgStore,
  setState: jest.fn(),
  subscribe: jest.fn(),
}

jest.mock('@/lib/stores/useOrganizationStore', () => ({
  useOrganizationStore: jest.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockOrgStore)
    }
    return mockOrgStore
  }),
  __esModule: true,
}))

describe('ComplianceRadarPage', () => {
  const theme = createTheme()

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useWebSocket as jest.Mock).mockReturnValue({
      socket: {
        on: jest.fn(),
        off: jest.fn(),
      },
      isConnected: false,
    })
  })

  describe('页面基础渲染', () => {
    it('should render page without crashing', () => {
      renderWithProviders(<ComplianceRadarPage />)
      expect(screen.getByText('合规雷达 - 风险预警与应对剧本')).toBeInTheDocument()
    })

    it('should render breadcrumb navigation', () => {
      renderWithProviders(<ComplianceRadarPage />)
      expect(screen.getByText('雷达首页')).toBeInTheDocument()
      expect(screen.getByText('合规雷达')).toBeInTheDocument()
    })

    it('should render back button', () => {
      renderWithProviders(<ComplianceRadarPage />)
      expect(screen.getByText('返回雷达')).toBeInTheDocument()
    })

    it('should render description text', () => {
      renderWithProviders(<ComplianceRadarPage />)
      expect(screen.getByText('监控监管风险，获取应对剧本，快速启动自查整改流程')).toBeInTheDocument()
    })
  })

  describe('骨架屏和加载状态', () => {
    it('should display loading skeleton initially', () => {
      renderWithProviders(<ComplianceRadarPage />)

      // 应该显示 3 个骨架屏
      const skeletons = document.querySelectorAll('.MuiSkeleton-root')
      expect(skeletons.length).toBe(3)
    })

    it('should render Skeleton components with correct height', () => {
      renderWithProviders(<ComplianceRadarPage />)

      const skeletons = document.querySelectorAll('.MuiSkeleton-root')
      skeletons.forEach((skeleton) => {
        expect(skeleton).toHaveStyle({ height: '300px' })
      })
    })
  })

  describe('操作按钮', () => {
    it('should render refresh button', () => {
      renderWithProviders(<ComplianceRadarPage />)
      expect(screen.getByText('刷新')).toBeInTheDocument()
    })

    it('should refresh button be disabled during loading', () => {
      renderWithProviders(<ComplianceRadarPage />)
      const refreshButton = screen.getByText('刷新').closest('button')
      expect(refreshButton).toBeDisabled()
    })
  })

  describe('页面结构', () => {
    it('should use Container component', () => {
      const { container } = renderWithProviders(<ComplianceRadarPage />)
      const containers = container.querySelectorAll('.MuiContainer-root')
      expect(containers.length).toBeGreaterThan(0)
    })

    it('should render Grid components', () => {
      const { container } = renderWithProviders(<ComplianceRadarPage />)
      const grids = container.querySelectorAll('.MuiGrid-root')
      expect(grids.length).toBeGreaterThan(0)
    })
  })
})
