import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MatrixPage from '../page'
import { useParams, useSearchParams, useRouter } from 'next/navigation'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/lib/api/ai-tasks', () => ({
  AITasksAPI: {
    getTasksByProject: jest.fn(),
    createTask: jest.fn(),
  },
}))

jest.mock('@/lib/hooks/useTaskProgress', () => ({
  useTaskProgress: jest.fn(() => ({
    progress: 0,
    message: '',
    isCompleted: false,
    isFailed: false,
  })),
}))

jest.mock('@/lib/hooks/useAITaskCache', () => ({
  useAITaskCache: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}))

// Mock components
jest.mock('@/components/features/MatrixResultDisplay', () => ({
  __esModule: true,
  default: ({ result }: any) => (
    <div data-testid="matrix-result">Matrix Result Display</div>
  ),
}))

jest.mock('@/components/projects/RerunTaskDialog', () => ({
  __esModule: true,
  default: ({ open }: any) =>
    open ? <div data-testid="rerun-dialog">Rerun Dialog</div> : null,
}))

jest.mock('@/components/projects/RollbackButton', () => ({
  __esModule: true,
  default: () => <button>Rollback</button>,
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
const mockUseSearchParams = useSearchParams as jest.Mock
const mockUseRouter = useRouter as jest.Mock

describe('MatrixPage', () => {
  const mockBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ projectId: 'project-1' })
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    mockUseRouter.mockReturnValue({ back: mockBack, push: jest.fn() })
  })

  it('should render page header with correct title', () => {
    render(<MatrixPage />)

    expect(screen.getByTestId('page-header')).toBeInTheDocument()
    expect(screen.getByText('成熟度矩阵')).toBeInTheDocument()
    expect(screen.getByText('生成成熟度评估矩阵，可视化展示合规成熟度水平')).toBeInTheDocument()
  })

  it('should show empty state initially', async () => {
    render(<MatrixPage />)

    await waitFor(() => {
      expect(screen.getByText('还没有生成成熟度矩阵')).toBeInTheDocument()
    })
  })

  it('should navigate back when back button is clicked', async () => {
    render(<MatrixPage />)

    await waitFor(() => {
      expect(screen.getByText('返回')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('返回'))

    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('should render generate button', async () => {
    render(<MatrixPage />)

    await waitFor(() => {
      expect(screen.getByText('生成矩阵')).toBeInTheDocument()
    })
  })

  it('should open rerun dialog when regenerate button is clicked', async () => {
    render(<MatrixPage />)

    await waitFor(() => {
      expect(screen.getByText('重新生成')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('重新生成'))

    expect(screen.getByTestId('rerun-dialog')).toBeInTheDocument()
  })
})
