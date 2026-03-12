import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProjectWorkbenchPage from '../page'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/utils/api'
import { AITasksAPI } from '@/lib/api/ai-tasks'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/lib/utils/api', () => ({
  apiFetch: jest.fn(),
}))

jest.mock('@/lib/api/ai-tasks', () => ({
  AITasksAPI: {
    getTasksByProject: jest.fn(),
  },
}))

// Mock components
jest.mock('@/components/projects/TaskStatusIndicator', () => ({
  __esModule: true,
  default: ({ status }: any) => <span data-testid="task-status">{status}</span>,
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

jest.mock('@/components/ui/gradient-card', () => ({
  GradientCard: ({ children, onClick, ...props }: any) => (
    <div onClick={onClick} {...props}>{children}</div>
  ),
}))

jest.mock('@/components/ui/unified-button', () => ({
  UnifiedButton: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}))

jest.mock('@/components/ui/status-badge', () => ({
  StatusBadge: ({ text }: any) => <span>{text}</span>,
}))

const mockUseParams = useParams as jest.Mock
const mockUseRouter = useRouter as jest.Mock
const mockApiFetch = apiFetch as jest.Mock
const mockGetTasksByProject = AITasksAPI.getTasksByProject as jest.Mock

describe('ProjectWorkbenchPage', () => {
  const mockPush = jest.fn()
  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    description: 'Test Description',
    status: 'ACTIVE',
    progress: 50,
    clientName: 'Test Client',
    standardName: 'ISO 27001',
    organizationId: 'org-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    metadata: {
      uploadedDocuments: [{ id: 'doc-1', name: 'Test Doc' }],
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ projectId: 'project-1' })
    mockUseRouter.mockReturnValue({ push: mockPush })
  })

  it('should show loading state initially', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {}))
    mockGetTasksByProject.mockImplementation(() => new Promise(() => {}))

    render(<ProjectWorkbenchPage />)

    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('should display project information after loading', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })
  })

  it('should display page header with project name', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeInTheDocument()
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })
  })

  it('should display all 10 functional modules', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('上传文档')).toBeInTheDocument()
      expect(screen.getByText('综述生成')).toBeInTheDocument()
      expect(screen.getByText('聚类分析')).toBeInTheDocument()
      expect(screen.getByText('标准解读')).toBeInTheDocument()
      expect(screen.getByText('成熟度矩阵')).toBeInTheDocument()
      expect(screen.getByText('问卷生成')).toBeInTheDocument()
      expect(screen.getByText('差距分析')).toBeInTheDocument()
      expect(screen.getByText('超简版差距分析')).toBeInTheDocument()
      expect(screen.getByText('改进措施')).toBeInTheDocument()
      expect(screen.getByText('Radar Service')).toBeInTheDocument()
    })
  })

  it('should navigate to upload page when upload module is clicked', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('上传文档')).toBeInTheDocument()
    })

    const uploadCard = screen.getByText('上传文档').closest('[role="link"]')
    fireEvent.click(uploadCard!)

    expect(mockPush).toHaveBeenCalledWith('/projects/project-1/upload')
  })

  it('should navigate to summary page when summary module is clicked', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('综述生成')).toBeInTheDocument()
    })

    const summaryCard = screen.getByText('综述生成').closest('[role="link"]')
    fireEvent.click(summaryCard!)

    expect(mockPush).toHaveBeenCalledWith('/projects/project-1/summary')
  })

  it('should navigate back to projects list when back button is clicked', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('返回项目列表')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('返回项目列表'))

    expect(mockPush).toHaveBeenCalledWith('/projects')
  })

  it('should display project details section', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('项目详情')).toBeInTheDocument()
      expect(screen.getByText('项目状态')).toBeInTheDocument()
      expect(screen.getByText('客户名称')).toBeInTheDocument()
      expect(screen.getByText('合规标准')).toBeInTheDocument()
      expect(screen.getByText('完成进度')).toBeInTheDocument()
    })
  })

  it('should display correct project status', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('进行中')).toBeInTheDocument()
    })
  })

  it('should display project metadata correctly', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument()
      expect(screen.getByText('ISO 27001')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })
  })

  it('should handle COMPLETED project status', async () => {
    mockApiFetch.mockResolvedValue({ ...mockProject, status: 'COMPLETED' })
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('已完成')).toBeInTheDocument()
    })
  })

  it('should handle DRAFT project status', async () => {
    mockApiFetch.mockResolvedValue({ ...mockProject, status: 'DRAFT' })
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('草稿')).toBeInTheDocument()
    })
  })

  it('should handle ARCHIVED project status', async () => {
    mockApiFetch.mockResolvedValue({ ...mockProject, status: 'ARCHIVED' })
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('已归档')).toBeInTheDocument()
    })
  })

  it('should handle missing client name', async () => {
    mockApiFetch.mockResolvedValue({ ...mockProject, clientName: null })
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getAllByText('-').length).toBeGreaterThan(0)
    })
  })

  it('should handle missing standard name', async () => {
    mockApiFetch.mockResolvedValue({ ...mockProject, standardName: null })
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getAllByText('-').length).toBeGreaterThan(0)
    })
  })

  it('should compute task statuses correctly from tasks', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([
      { type: 'summary', status: 'completed', createdAt: '2024-01-01T00:00:00Z' },
      { type: 'clustering', status: 'processing', createdAt: '2024-01-01T00:00:00Z' },
      { type: 'matrix', status: 'failed', createdAt: '2024-01-01T00:00:00Z' },
    ])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      const statuses = screen.getAllByTestId('task-status')
      expect(statuses.length).toBeGreaterThan(0)
    })
  })

  it('should mark upload as completed when documents exist', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      const uploadStatus = screen.getByText('上传文档').closest('div')?.querySelector('[data-testid="task-status"]')
      expect(uploadStatus).toHaveTextContent('completed')
    })
  })

  it('should mark upload as pending when no documents exist', async () => {
    mockApiFetch.mockResolvedValue({
      ...mockProject,
      metadata: { uploadedDocuments: [] },
    })
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      const uploadStatus = screen.getByText('上传文档').closest('div')?.querySelector('[data-testid="task-status"]')
      expect(uploadStatus).toHaveTextContent('pending')
    })
  })

  it('should navigate to radar service with orgId', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('Radar Service')).toBeInTheDocument()
    })

    const radarCard = screen.getByText('Radar Service').closest('[role="link"]')
    fireEvent.click(radarCard!)

    expect(mockPush).toHaveBeenCalledWith('/radar?orgId=org-1')
  })

  it('should display correct button text for first module', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('开始')).toBeInTheDocument()
    })
  })

  it('should display correct button text for completed modules', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([
      { type: 'summary', status: 'completed', createdAt: '2024-01-01T00:00:00Z' },
    ])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('查看')).toBeInTheDocument()
    })
  })

  it('should display correct button text for pending modules', async () => {
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getByText('进入')).toBeInTheDocument()
    })
  })
})
