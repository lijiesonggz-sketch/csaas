import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UploadPage from '../page'
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
  },
}))

// Mock UI components
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

describe('UploadPage', () => {
  const mockBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ projectId: 'project-1' })
    mockUseRouter.mockReturnValue({ back: mockBack })

    // Mock fetch for session
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        accessToken: 'test-token',
        user: { id: 'user-1' },
      }),
    })
  })

  it('should render page header with correct title', () => {
    render(<UploadPage />)

    expect(screen.getByTestId('page-header')).toBeInTheDocument()
    expect(screen.getByText('上传文档')).toBeInTheDocument()
    expect(screen.getByText('上传项目相关文档，支持 PDF、Word、Excel 等格式')).toBeInTheDocument()
  })

  it('should render file upload area', () => {
    render(<UploadPage />)

    expect(screen.getByText('选择文件或拖拽到此处')).toBeInTheDocument()
    expect(screen.getByText('支持 PDF、TXT、MD、DOCX 格式，最大 10MB')).toBeInTheDocument()
  })

  it('should navigate back when back button is clicked', () => {
    render(<UploadPage />)

    fireEvent.click(screen.getByText('返回'))

    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('should render file input', () => {
    render(<UploadPage />)

    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
    expect(fileInput).toHaveAttribute('accept', '.pdf,.txt,.md,.docx')
  })

  it('should show info alert with tips', () => {
    render(<UploadPage />)

    expect(screen.getByText('提示')).toBeInTheDocument()
    expect(screen.getByText(/上传的文档将用于AI分析和文档处理/)).toBeInTheDocument()
  })
})
