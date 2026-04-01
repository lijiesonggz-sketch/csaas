import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import RadarDashboardPage from './page'
import { useRadarUnreadCount } from '@/lib/hooks/useRadarUnreadCount'

const mockPush = jest.fn()
const mockGet = jest.fn(() => null)

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
  })),
  useSearchParams: jest.fn(() => ({
    get: mockGet,
  })),
}))

jest.mock('@/lib/hooks/useOnboarding', () => ({
  useOnboarding: jest.fn(() => ({
    isOnboarded: true,
    radarActivated: true,
    isLoading: false,
    refetch: jest.fn(),
  })),
}))

jest.mock('@/lib/hooks/useRadarUnreadCount', () => ({
  useRadarUnreadCount: jest.fn(() => ({
    unreadCount: 3,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
  })),
}))

describe('RadarDashboardPage', () => {
  const mockUseRadarUnreadCount = useRadarUnreadCount as jest.Mock

  const renderWithProviders = () => render(<RadarDashboardPage />)

  beforeEach(() => {
    jest.clearAllMocks()
    mockGet.mockImplementation(() => null)
    mockUseRadarUnreadCount.mockReturnValue({
      unreadCount: 3,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    })
  })

  it('renders the dashboard header and three radar entries', async () => {
    renderWithProviders()

    expect(await screen.findByText('Radar Service')).toBeInTheDocument()
    expect(screen.getByText('技术雷达')).toBeInTheDocument()
    expect(screen.getByText('行业雷达')).toBeInTheDocument()
    expect(screen.getByText('合规雷达')).toBeInTheDocument()
  })

  it('navigates to radar routes from the action buttons', async () => {
    renderWithProviders()

    const enterButtons = await screen.findAllByText('进入雷达')
    mockPush.mockClear()

    fireEvent.click(enterButtons[0])
    fireEvent.click(enterButtons[1])
    fireEvent.click(enterButtons[2])

    expect(mockPush).toHaveBeenCalledWith('/radar/tech')
    expect(mockPush).toHaveBeenCalledWith('/radar/industry')
    expect(mockPush).toHaveBeenCalledWith('/radar/compliance')
  })

  it('renders history entry with unread badge and navigates to history', async () => {
    renderWithProviders()

    const historyButton = await screen.findByText('推送历史')
    expect(historyButton).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    mockPush.mockClear()
    fireEvent.click(historyButton)

    expect(mockPush).toHaveBeenCalledWith('/radar/history')
  })

  it('propagates orgId into radar routes and info box when provided', async () => {
    mockGet.mockImplementation((key: string) => (key === 'orgId' ? 'org-456' : null))

    renderWithProviders()

    expect(await screen.findByText(/您的组织ID/)).toBeInTheDocument()
    expect(screen.getByText('org-456')).toBeInTheDocument()

    mockPush.mockClear()
    fireEvent.click(screen.getAllByText('进入雷达')[0])
    expect(mockPush).toHaveBeenCalledWith('/radar/tech?orgId=org-456')

    mockPush.mockClear()
    fireEvent.click(screen.getByText('推送历史'))
    expect(mockPush).toHaveBeenCalledWith('/radar/history?orgId=org-456')
  })

  it('shows the no-organization hint when orgId is missing', async () => {
    renderWithProviders()

    expect(await screen.findByText(/请先选择组织/)).toBeInTheDocument()
  })
})
