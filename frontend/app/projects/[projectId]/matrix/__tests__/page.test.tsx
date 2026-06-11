import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import MatrixPage from '../page'
import { useParams, useSearchParams, useRouter } from 'next/navigation'

const mockCacheGet = jest.fn()
const mockCacheSet = jest.fn()

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/lib/api/ai-tasks', () => ({
  AITasksAPI: {
    getTasksByProject: jest.fn().mockResolvedValue([]),
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

jest.mock('@/lib/hooks/useTaskProgressPolling', () => ({
  useTaskProgressPolling: jest.fn(() => ({
    progress: {
      status: 'processing',
      stage: 'generating_models',
      progress: { percentage: 42 },
      message: '正在生成成熟度矩阵 (20/48)',
    },
  })),
}))

jest.mock('@/lib/hooks/useAITaskCache', () => ({
  useAITaskCache: jest.fn(() => ({
    get: mockCacheGet,
    set: mockCacheSet,
  })),
}))

jest.mock('@/components/features/MatrixResultDisplay', () => ({
  __esModule: true,
  default: ({ result }: any) => <div data-testid="matrix-result">{result.taskId}</div>,
}))

jest.mock('@/components/projects/RerunTaskDialog', () => ({
  __esModule: true,
  default: ({ open }: any) => (open ? <div data-testid="rerun-dialog">Rerun Dialog</div> : null),
}))

jest.mock('@/components/projects/RollbackButton', () => ({
  __esModule: true,
  default: () => <button>Rollback</button>,
}))

describe('MatrixPage', () => {
  const mockBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockCacheGet.mockReturnValue(null)
    ;(useParams as jest.Mock).mockReturnValue({ projectId: 'project-1' })
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams())
    ;(useRouter as jest.Mock).mockReturnValue({ back: mockBack, push: jest.fn() })
  })

  it('renders the current title and empty state', async () => {
    render(<MatrixPage />)

    expect(await screen.findByText('还没有生成成熟度矩阵')).toBeInTheDocument()
    expect(screen.getByText('成熟度矩阵')).toBeInTheDocument()
    expect(screen.getByText('生成矩阵')).toBeInTheDocument()
  })

  it('navigates back from the current header action', async () => {
    render(<MatrixPage />)

    fireEvent.click(await screen.findByRole('button', { name: /返回/ }))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('resumes the latest processing matrix task after page reload', async () => {
    const { AITasksAPI } = await import('@/lib/api/ai-tasks')
    ;(AITasksAPI.getTasksByProject as jest.Mock).mockResolvedValueOnce([
      {
        id: 'matrix-task-1',
        projectId: 'project-1',
        type: 'matrix',
        status: 'processing',
        input: { clusteringTaskId: 'clustering-task-1' },
        result: null,
        progress: 0,
        createdAt: '2026-06-02T13:34:33.859Z',
        updatedAt: '2026-06-02T13:34:33.920Z',
      },
    ])

    render(<MatrixPage />)

    expect(await screen.findByRole('heading', { name: '正在生成成熟度矩阵' })).toBeInTheDocument()
    expect(screen.getByText(/正在生成成熟度矩阵 \(20\/48\)/)).toBeInTheDocument()
    expect(screen.queryByText('点击下方按钮开始生成成熟度矩阵')).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
    expect(screen.queryByRole('button', { name: '生成矩阵' })).not.toBeInTheDocument()
  })

  it('does not render stale cached matrix before confirming the latest matrix task', async () => {
    const { AITasksAPI } = await import('@/lib/api/ai-tasks')
    mockCacheGet.mockReturnValue({
      taskId: 'matrix-task-old',
      selectedResult: {
        matrix: [
          {
            cluster_id: 'category_5_1',
            cluster_name: '5.1 战略规划',
            levels: {
              level_1: {
                name: '初始级',
                description: '旧过程描述',
                key_practices: ['利益相关者分析，明确利益相关者的需求；'],
              },
            },
          },
        ],
      },
    })
    ;(AITasksAPI.getTasksByProject as jest.Mock).mockImplementationOnce(() => new Promise(() => {}))

    render(<MatrixPage />)

    await waitFor(() => expect(AITasksAPI.getTasksByProject).toHaveBeenCalled())

    expect(screen.queryByText('matrix-task-old')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '还没有生成成熟度矩阵' })).toBeInTheDocument()
  })
})
