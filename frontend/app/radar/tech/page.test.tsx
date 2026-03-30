import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'

import TechRadarPage from './page'
import { getRadarPushes, normalizeRadarPush, RadarPush } from '@/lib/api/radar'
import { useWebSocket } from '@/lib/hooks/useWebSocket'

jest.mock('@/lib/api/radar')
jest.mock('@/lib/hooks/useWebSocket')

jest.mock('@/lib/stores/useOrganizationStore', () => {
  const mockStore = {
    currentOrganization: { id: 'org-1', name: '测试银行' },
    organizations: [{ id: 'org-1', name: '测试银行' }],
    fetchOrganizations: jest.fn().mockResolvedValue(undefined),
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

describe('TechRadarPage', () => {
  const theme = createTheme()

  const renderWithProviders = () =>
    render(
      <ThemeProvider theme={theme}>
        <TechRadarPage />
      </ThemeProvider>,
    )

  const techContext = (pushId: string) => ({
    controlId: null,
    matchedControls: [],
    sourceModule: 'radar' as const,
    sourceRecordId: pushId,
    sourceRoute: '/radar/tech',
  })

  const basePush: RadarPush = {
    ...techContext('push-1'),
    pushId: 'push-1',
    radarType: 'tech',
    title: '零信任架构在金融行业的应用',
    summary: '介绍零信任架构的实施方案和成本收益分析',
    fullContent: '详细内容...',
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
      recommendedVendors: ['阿里云'],
    },
    isRead: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(normalizeRadarPush as jest.Mock).mockImplementation((push) => push)
    ;(getRadarPushes as jest.Mock).mockResolvedValue({
      data: [basePush],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    ;(useWebSocket as jest.Mock).mockReturnValue({
      socket: null,
      isConnected: true,
    })
    global.Notification = {
      permission: 'default',
      requestPermission: jest.fn().mockResolvedValue('granted'),
    } as any
  })

  it('renders the current page title and loads pushes from the API', async () => {
    renderWithProviders()

    expect(await screen.findByText('技术雷达 - ROI导向的技术决策支持')).toBeInTheDocument()
    expect(getRadarPushes).toHaveBeenCalledWith({
      radarType: 'tech',
      status: 'sent',
      page: 1,
      limit: 20,
    })
    expect(screen.getByText(basePush.title)).toBeInTheDocument()
  })

  it('shows the current connection status text', async () => {
    renderWithProviders()

    expect(await screen.findByText('实时推送已连接')).toBeInTheDocument()
  })

  it('shows the current empty state when the API returns no pushes', async () => {
    ;(getRadarPushes as jest.Mock).mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })

    renderWithProviders()

    expect(await screen.findByText('暂无推送内容')).toBeInTheDocument()
  })

  it('shows API errors without relying on legacy layout selectors', async () => {
    ;(getRadarPushes as jest.Mock).mockRejectedValue(new Error('网络连接失败'))

    renderWithProviders()

    expect(await screen.findByText('网络连接失败')).toBeInTheDocument()
  })

  it('prepends a normalized tech push from WebSocket', async () => {
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
      ...techContext('push-new'),
      ...basePush,
      pushId: 'push-new',
      sourceRecordId: 'push-new',
      title: '新推送：AI驱动的安全防护',
    })

    expect(await screen.findByText('新推送：AI驱动的安全防护')).toBeInTheDocument()
  })

  it('refreshes the list when clicking the refresh button', async () => {
    renderWithProviders()

    await screen.findByText(basePush.title)
    fireEvent.click(screen.getByRole('button', { name: /刷新/i }))

    await waitFor(() => {
      expect(getRadarPushes).toHaveBeenCalledTimes(2)
    })
  })
})
