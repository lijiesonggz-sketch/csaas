import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QuickGapAnalysisPage from '../page'
import { useParams, useRouter } from 'next/navigation'

// Mock dependencies
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

// Mock MUI components
jest.mock('@mui/material', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ title }: any) => <div>{title}</div>,
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
  AlertTitle: ({ children }: any) => <strong>{children}</strong>,
  Box: ({ children }: any) => <div>{children}</div>,
  Typography: ({ children }: any) => <span>{children}</span>,
  TextField: ({ value, onChange, placeholder }: any) => (
    <textarea value={value} onChange={onChange} placeholder={placeholder} />
  ),
  LinearProgress: () => <div role="progressbar">Loading...</div>,
  Chip: ({ label }: any) => <span>{label}</span>,
  Tabs: ({ children }: any) => <div>{children}</div>,
  Tab: ({ label }: any) => <button>{label}</button>,
  Grid: ({ children }: any) => <div>{children}</div>,
}))

jest.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title, description, actions }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </div>
  ),
}))

jest.mock('@/components/ui/unified-button', () => ({
  UnifiedButton: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}))

jest.mock('@/components/ui/gradient-card', () => ({
  GradientCard: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}))

const mockUseParams = useParams as jest.Mock
const mockUseRouter = useRouter as jest.Mock

describe('QuickGapAnalysisPage', () => {
  const mockBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ projectId: 'project-1' })
    mockUseRouter.mockReturnValue({ back: mockBack })
  })

  it('should render page header with correct title', () => {
    render(<QuickGapAnalysisPage />)

    expect(screen.getByTestId('page-header')).toBeInTheDocument()
    expect(screen.getByText('快速差距分析')).toBeInTheDocument()
    expect(screen.getByText('输入您的现状描述，快速获取差距分析结果')).toBeInTheDocument()
  })

  it('should render input form initially', () => {
    render(<QuickGapAnalysisPage />)

    expect(screen.getByPlaceholderText(/请描述您当前的IT安全现状/)).toBeInTheDocument()
    expect(screen.getByText('开始分析')).toBeInTheDocument()
  })

  it('should navigate back when back button is clicked', () => {
    render(<QuickGapAnalysisPage />)

    fireEvent.click(screen.getByText('返回'))

    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('should update input value on change', () => {
    render(<QuickGapAnalysisPage />)

    const textarea = screen.getByPlaceholderText(/请描述您当前的IT安全现状/)
    fireEvent.change(textarea, { target: { value: 'Test input' } })

    expect(textarea).toHaveValue('Test input')
  })

  it('should disable submit button when input is empty', () => {
    render(<QuickGapAnalysisPage />)

    expect(screen.getByText('开始分析')).toBeDisabled()
  })

  it('should enable submit button when input has content', () => {
    render(<QuickGapAnalysisPage />)

    const textarea = screen.getByPlaceholderText(/请描述您当前的IT安全现状/)
    fireEvent.change(textarea, { target: { value: 'Test input' } })

    expect(screen.getByText('开始分析')).not.toBeDisabled()
  })
})
