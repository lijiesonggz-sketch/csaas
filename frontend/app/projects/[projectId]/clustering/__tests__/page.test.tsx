import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ClusteringPage from '../page'
import { useParams, useRouter } from 'next/navigation'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/lib/contexts/ProjectContext', () => ({
  useProject: jest.fn(() => ({
    project: {
      id: 'project-1',
      metadata: {
        uploadedDocuments: [{ id: 'doc-1', name: 'Test Doc' }],
      },
    },
  })),
}))

jest.mock('@/lib/hooks/useTaskProgressPolling', () => ({
  useTaskProgressPolling: jest.fn(() => ({
    progress: null,
  })),
}))

// Mock components
jest.mock('@/components/features/ClusteringResultDisplay', () => ({
  __esModule: true,
  default: ({ result }: any) => (
    <div data-testid="clustering-result">Clustering Result Display</div>
  ),
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

describe('ClusteringPage', () => {
  const mockBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ projectId: 'project-1' })
    mockUseRouter.mockReturnValue({ back: mockBack })
  })

  it('should render page header with correct title', () => {
    render(<ClusteringPage />)

    expect(screen.getByTestId('page-header')).toBeInTheDocument()
    expect(screen.getByText('聚类分析')).toBeInTheDocument()
    expect(screen.getByText('基于标准文档生成聚类分析结果')).toBeInTheDocument()
  })

  it('should show loading state initially', () => {
    render(<ClusteringPage />)

    expect(screen.getByText('正在加载...')).toBeInTheDocument()
  })

  it('should navigate back when back button is clicked', async () => {
    render(<ClusteringPage />)

    await waitFor(() => {
      expect(screen.getByText('返回')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('返回'))

    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('should render regenerate button', async () => {
    render(<ClusteringPage />)

    await waitFor(() => {
      expect(screen.getByText('重新生成')).toBeInTheDocument()
    })
  })
})
