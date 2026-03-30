import { fireEvent, render, screen } from '@testing-library/react'

import QuickGapAnalysisPage from '../page'
import { useParams, useRouter } from 'next/navigation'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/lib/message', () => ({
  message: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}))

describe('QuickGapAnalysisPage', () => {
  const mockBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({ projectId: 'project-1' })
    ;(useRouter as jest.Mock).mockReturnValue({ back: mockBack })
  })

  it('renders the current title and input form', () => {
    render(<QuickGapAnalysisPage />)

    expect(screen.getByText('快速差距分析')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/请描述您当前的IT安全现状/)).toBeInTheDocument()
    expect(screen.getByText('开始分析')).toBeDisabled()
  })

  it('updates the textarea value', () => {
    render(<QuickGapAnalysisPage />)

    const textarea = screen.getByPlaceholderText(/请描述您当前的IT安全现状/)
    fireEvent.change(textarea, { target: { value: 'Test input' } })

    expect(textarea).toHaveValue('Test input')
    expect(screen.getByText('开始分析')).not.toBeDisabled()
  })

  it('navigates back from the current header action', () => {
    render(<QuickGapAnalysisPage />)

    fireEvent.click(screen.getByRole('button', { name: /返回/ }))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })
})
