import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import SummaryPage from '../page'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/utils/api'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/lib/utils/api', () => ({
  apiFetch: jest.fn(),
}))

jest.mock('@/lib/hooks/useTaskProgressPolling', () => ({
  useTaskProgressPolling: jest.fn(() => ({
    progress: null,
  })),
}))

jest.mock('@/components/features/SummaryResultDisplay', () => ({
  __esModule: true,
  default: () => <div data-testid="summary-result">Summary Result Display</div>,
}))

describe('SummaryPage', () => {
  const mockBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({ projectId: 'project-1' })
    ;(useRouter as jest.Mock).mockReturnValue({ back: mockBack })
    ;(apiFetch as jest.Mock).mockResolvedValue({ metadata: {} })
  })

  it('renders the current title and empty state', async () => {
    render(<SummaryPage />)

    expect(await screen.findByText('还没有生成综述')).toBeInTheDocument()
    expect(screen.getByText('综述生成')).toBeInTheDocument()
    expect(screen.getByText('生成综述')).toBeInTheDocument()
  })

  it('shows the current initializing copy first', () => {
    render(<SummaryPage />)
    expect(screen.getByText('正在加载...')).toBeInTheDocument()
  })

  it('navigates back from the current header action', async () => {
    render(<SummaryPage />)

    fireEvent.click(await screen.findByRole('button', { name: /返回/ }))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })
})
