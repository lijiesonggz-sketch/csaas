import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import PeerCrawlerPage from './page'
import * as radarSourcesApi from '@/lib/api/radar-sources'

const mockPush = jest.fn()
const mockUseSession = jest.fn(() => ({
  data: { user: { id: 'user-1', role: 'admin' } },
  status: 'authenticated',
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/components/admin/PeerCrawlerSourceList', () => ({
  PeerCrawlerSourceList: ({
    sources,
    loading,
    error,
  }: {
    sources: Array<{ id: string }>
    loading: boolean
    error: string | null
  }) => (
    <div>
      <div>peer-crawler-source-list</div>
      <div>{loading ? 'loading' : 'loaded'}</div>
      <div>{error ?? 'no-error'}</div>
      <div>{sources.length}</div>
    </div>
  ),
}))

jest.mock('@/components/admin/PeerCrawlerSourceForm', () => ({
  PeerCrawlerSourceForm: () => null,
}))

jest.mock('@/components/admin/TestCrawlDialog', () => ({
  TestCrawlDialog: () => null,
}))

jest.mock('@/components/ui/tabs', () => {
  const Tabs = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const TabsList = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const TabsTrigger = ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button type="button" data-value={value}>
      {children}
    </button>
  )
  const TabsContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  return { Tabs, TabsList, TabsTrigger, TabsContent }
})

jest.mock('@/lib/api/radar-sources')

const mockGetRadarSources = radarSourcesApi.getRadarSources as jest.MockedFunction<
  typeof radarSourcesApi.getRadarSources
>

describe('PeerCrawlerPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockReset()
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-1', role: 'admin' } },
      status: 'authenticated',
    })
    mockGetRadarSources.mockResolvedValue({
      success: true,
      data: [],
      total: 0,
    })
  })

  it('does not render a redundant dashboard return action in the page header', async () => {
    render(<PeerCrawlerPage />)

    await waitFor(() => expect(mockGetRadarSources).toHaveBeenCalledWith({ category: 'industry' }))
    expect(screen.getByText('同业采集源管理')).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: '返回' })).not.toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalledWith('/dashboard')
  })
})
