import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'

import IndustryRadarPage from './page'
import {
  bookmarkPeerMonitoringPush,
  getIndustryPushes,
  getPeerMonitoringPushes,
  getWatchedPeers,
  markPeerMonitoringPushAsRead,
  normalizeRadarPush,
  RadarPush,
} from '@/lib/api/radar'
import { useWebSocket } from '@/lib/hooks/useWebSocket'

jest.mock('@/lib/api/radar')
jest.mock('@/lib/hooks/useWebSocket')

jest.mock('@/lib/stores/useOrganizationStore', () => {
  const mockStore = {
    currentOrganization: { id: 'org-1', name: '测试银行' },
    organizations: [{ id: 'org-1', name: '测试银行' }],
    weaknesses: [],
    aggregatedWeaknesses: [],
    loading: false,
    error: null,
    fetchOrganizations: jest.fn().mockResolvedValue(undefined),
    setCurrentOrganization: jest.fn(),
    fetchWeaknesses: jest.fn().mockResolvedValue(undefined),
    clearError: jest.fn(),
  }

  const useOrganizationStore = jest.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockStore)
    }
    return mockStore
  })

  useOrganizationStore.getState = jest.fn().mockReturnValue(mockStore)

  return {
    useOrganizationStore,
    __esModule: true,
  }
})

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(() => ({
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        filter: 'all',
        tab: 'industry',
        peerFilter: 'all',
        selectedPeer: '',
      }
      return values[key] || null
    }),
    toString: jest.fn(() => 'filter=all&tab=industry'),
  })),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
}))

jest.mock('next/link', () => {
  return function MockLink(props: { href: string; children: React.ReactNode }) {
    return React.createElement('a', { href: props.href }, props.children)
  }
})

describe('IndustryRadarPage', () => {
  const theme = createTheme()

  const renderWithProviders = () =>
    render(
      <ThemeProvider theme={theme}>
        <IndustryRadarPage />
      </ThemeProvider>,
    )

  const industryContext = (pushId: string) => ({
    controlId: null,
    matchedControls: [],
    sourceModule: 'radar' as const,
    sourceRecordId: pushId,
    sourceRoute: '/radar/industry',
  })

  const pushes: RadarPush[] = [
    {
      ...industryContext('industry-1'),
      pushId: 'industry-1',
      radarType: 'industry',
      title: '招商银行云原生转型实践',
      summary: '该银行采用Kubernetes实现容器化部署',
      relevanceScore: 0.95,
      priorityLevel: 1,
      weaknessCategories: ['系统架构'],
      publishDate: '2024-01-15T00:00:00Z',
      source: '银行业技术论坛',
      peerName: '招商银行',
      practiceDescription: '详细的实践描述...',
      estimatedCost: '300-500万',
      implementationPeriod: '6-12个月',
      technicalEffect: '系统可用性提升至99.99%',
      isRead: false,
      url: 'https://example.com/article-1',
      tags: ['云原生', 'Kubernetes'],
      targetAudience: 'IT总监',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(normalizeRadarPush as jest.Mock).mockImplementation((push) => push)
    ;(getIndustryPushes as jest.Mock).mockResolvedValue({
      data: pushes,
      pagination: { page: 1, limit: 20, total: pushes.length, totalPages: 1 },
    })
    ;(getWatchedPeers as jest.Mock).mockResolvedValue([
      {
        id: 'peer-1',
        peerName: '招商银行',
        organizationId: 'org-1',
        industry: 'banking',
        institutionType: '股份制银行',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ])
    ;(getPeerMonitoringPushes as jest.Mock).mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })
    ;(markPeerMonitoringPushAsRead as jest.Mock).mockResolvedValue(undefined)
    ;(bookmarkPeerMonitoringPush as jest.Mock).mockResolvedValue(undefined)
    ;(useWebSocket as jest.Mock).mockReturnValue({
      socket: { on: jest.fn(), off: jest.fn() },
      isConnected: true,
    })
  })

  it('renders the current title, filters, and loaded push', async () => {
    renderWithProviders()

    expect(await screen.findByText('行业雷达 - 同业标杆学习')).toBeInTheDocument()
    expect(screen.getByText('全部')).toBeInTheDocument()
    expect(screen.getByText('我关注的同业')).toBeInTheDocument()
    expect(screen.getByText('招商银行云原生转型实践')).toBeInTheDocument()
  })

  it('calls the industry API with the current filter state', async () => {
    renderWithProviders()

    await waitFor(() => {
      expect(getIndustryPushes).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          filter: 'all',
          page: 1,
          limit: 20,
        }),
      )
    })
  })

  it('shows the current connection status text', async () => {
    renderWithProviders()
    expect(await screen.findByText('实时推送已连接')).toBeInTheDocument()
  })

  it('prepends a normalized industry push from WebSocket', async () => {
    const mockSocket = { on: jest.fn(), off: jest.fn() }
    ;(useWebSocket as jest.Mock).mockReturnValue({
      socket: mockSocket,
      isConnected: true,
    })

    renderWithProviders()

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith('radar:push:new', expect.any(Function))
    })

    const callback = mockSocket.on.mock.calls.find((call) => call[0] === 'radar:push:new')?.[1]
    callback?.({
      ...industryContext('industry-new'),
      ...pushes[0],
      pushId: 'industry-new',
      sourceRecordId: 'industry-new',
      title: '新的行业标杆案例',
    })

    expect(await screen.findByText('新的行业标杆案例')).toBeInTheDocument()
  })

  it('shows the current empty state when no pushes are returned', async () => {
    ;(getIndustryPushes as jest.Mock).mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })

    renderWithProviders()
    expect(await screen.findByText('暂无行业雷达推送')).toBeInTheDocument()
  })
})
