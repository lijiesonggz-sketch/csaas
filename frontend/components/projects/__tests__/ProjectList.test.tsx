import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProjectList from '../ProjectList'
import { apiFetch } from '@/lib/utils/api'
import { useRouter } from 'next/navigation'

// Mock dependencies
jest.mock('@/lib/utils/api')
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock child components
jest.mock('../ProjectCard', () => ({
  __esModule: true,
  default: ({ project, onClick, onDelete }: any) => (
    <div data-testid={`project-card-${project.id}`}>
      <span>{project.name}</span>
      <button onClick={onClick}>View</button>
      <button onClick={onDelete}>Delete</button>
    </div>
  ),
}))

jest.mock('../CreateProjectDialog', () => ({
  __esModule: true,
  default: ({ open, onClose, onCreated }: any) =>
    open ? (
      <div data-testid="create-dialog">
        <button onClick={onCreated}>Create</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
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
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

const mockApiFetch = apiFetch as jest.Mock
const mockUseRouter = useRouter as jest.Mock

describe('ProjectList', () => {
  const mockOnProjectClick = jest.fn()
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({ push: mockPush })
  })

  const mockProjects = [
    {
      id: '1',
      name: 'Project 1',
      description: 'Description 1',
      status: 'ACTIVE',
      progress: 50,
      clientName: 'Client 1',
      standardName: 'ISO 27001',
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Project 2',
      description: 'Description 2',
      status: 'COMPLETED',
      progress: 100,
      clientName: 'Client 2',
      standardName: 'GDPR',
      createdAt: '2024-01-02T00:00:00Z',
    },
  ]

  it('should show loading state initially', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {}))

    render(<ProjectList onProjectClick={mockOnProjectClick} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('加载项目列表...')).toBeInTheDocument()
  })

  it('should display projects after loading', async () => {
    mockApiFetch.mockResolvedValue(mockProjects)

    render(<ProjectList onProjectClick={mockOnProjectClick} />)

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument()
      expect(screen.getByText('Project 2')).toBeInTheDocument()
    })
  })

  it('should display empty state when no projects', async () => {
    mockApiFetch.mockResolvedValue([])

    render(<ProjectList onProjectClick={mockOnProjectClick} />)

    await waitFor(() => {
      expect(screen.getByText('还没有任何项目')).toBeInTheDocument()
      expect(screen.getByText('点击上方"创建项目"按钮开始您的第一个咨询项目')).toBeInTheDocument()
    })
  })

  it('should show error state when API fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'))

    render(<ProjectList onProjectClick={mockOnProjectClick} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('should retry loading when retry button is clicked', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'))
    mockApiFetch.mockResolvedValueOnce(mockProjects)

    render(<ProjectList onProjectClick={mockOnProjectClick} />)

    await waitFor(() => {
      expect(screen.getByText('重试')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('重试'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(2)
    })
  })

  it('should open create dialog when create button is clicked', async () => {
    mockApiFetch.mockResolvedValue(mockProjects)

    render(<ProjectList onProjectClick={mockOnProjectClick} />)

    await waitFor(() => {
      expect(screen.getByText('创建项目')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('创建项目'))

    expect(screen.getByTestId('create-dialog')).toBeInTheDocument()
  })

  it('should close create dialog when close button is clicked', async () => {
    mockApiFetch.mockResolvedValue(mockProjects)

    render(<ProjectList onProjectClick={mockOnProjectClick} />)

    await waitFor(() => {
      expect(screen.getByText('创建项目')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('创建项目'))
    expect(screen.getByTestId('create-dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByTestId('create-dialog')).not.toBeInTheDocument()
  })

  it('should refresh project list after project is created', async () => {
    mockApiFetch.mockResolvedValue(mockProjects)

    render(<ProjectList onProjectClick={mockOnProjectClick} />)

    await waitFor(() => {
      expect(screen.getByText('创建项目')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('创建项目'))
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(2)
    })
  })

  it('should refresh project list after project is deleted', async () => {
    mockApiFetch.mockResolvedValue(mockProjects)

    render(<ProjectList onProjectClick={mockOnProjectClick} />)

    await waitFor(() => {
      expect(screen.getByTestId('project-card-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByText('Delete')[0])

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(2)
    })
  })

  it('should navigate to dashboard when back button is clicked', async () => {
    mockApiFetch.mockResolvedValue(mockProjects)

    render(<ProjectList onProjectClick={mockOnProjectClick} />)

    await waitFor(() => {
      expect(screen.getByText('返回工作台')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('返回工作台'))

    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('should call onProjectClick when project card is clicked', async () => {
    mockApiFetch.mockResolvedValue(mockProjects)

    render(<ProjectList onProjectClick={mockOnProjectClick} />)

    await waitFor(() => {
      expect(screen.getByTestId('project-card-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByText('View')[0])

    expect(mockOnProjectClick).toHaveBeenCalledWith(mockProjects[0])
  })

  it('should display page header with correct title and description', async () => {
    mockApiFetch.mockResolvedValue(mockProjects)

    render(<ProjectList onProjectClick={mockOnProjectClick} />)

    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeInTheDocument()
      expect(screen.getByText('我的项目')).toBeInTheDocument()
      expect(screen.getByText('管理您的合规咨询项目，跟踪项目进度和AI分析结果')).toBeInTheDocument()
    })
  })

  it('should render project grid with correct role', async () => {
    mockApiFetch.mockResolvedValue(mockProjects)

    render(<ProjectList onProjectClick={mockOnProjectClick} />)

    await waitFor(() => {
      const grid = screen.getByRole('list', { name: '项目列表' })
      expect(grid).toBeInTheDocument()
    })
  })
})
