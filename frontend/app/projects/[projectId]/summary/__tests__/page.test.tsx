import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import SummaryPage from '../page'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/utils/api'
import { AITasksAPI } from '@/lib/api/ai-tasks'
import { useTaskProgressPolling } from '@/lib/hooks/useTaskProgressPolling'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/lib/utils/api', () => ({
  apiFetch: jest.fn(),
}))

jest.mock('@/lib/api/ai-tasks', () => ({
  AITasksAPI: {
    createTask: jest.fn(),
    getTask: jest.fn(),
    getTaskStatus: jest.fn(),
  },
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
  const mockGetTask = AITasksAPI.getTask as jest.MockedFunction<typeof AITasksAPI.getTask>
  const mockGetTaskStatus = AITasksAPI.getTaskStatus as jest.MockedFunction<
    typeof AITasksAPI.getTaskStatus
  >
  const mockUseTaskProgressPolling = useTaskProgressPolling as jest.MockedFunction<
    typeof useTaskProgressPolling
  >

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({ projectId: 'project-1' })
    ;(useRouter as jest.Mock).mockReturnValue({ back: mockBack })
    ;(apiFetch as jest.Mock).mockResolvedValue({ metadata: {} })
    mockUseTaskProgressPolling.mockReturnValue({
      progress: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      startPolling: jest.fn(),
      stopPolling: jest.fn(),
    })
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

  it('hydrates and displays completed saved summary tasks without manual refresh', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({
      metadata: {
        summaryTaskId: 'task-1',
      },
    })
    mockGetTask.mockResolvedValue({
      id: 'task-1',
      projectId: 'project-1',
      type: 'summary',
      status: 'completed',
      input: {},
      result: {
        content: JSON.stringify({
          title: '综述标题',
          overview: '综述内容',
        }),
      },
      progress: 100,
      createdAt: '2026-03-30T11:47:54.764Z',
      updatedAt: '2026-03-30T11:49:43.139Z',
      events: [],
      costs: [],
    } as any)

    render(<SummaryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('summary-result')).toBeInTheDocument()
    })
  })

  it('hydrates result after polling reports completion for an in-flight saved task', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({
      metadata: {
        summaryTaskId: 'task-2',
      },
    })
    mockGetTask
      .mockResolvedValueOnce({
        id: 'task-2',
        projectId: 'project-1',
        type: 'summary',
        status: 'processing',
        input: {},
        result: null,
        progress: 30,
        createdAt: '2026-03-30T11:47:54.764Z',
        updatedAt: '2026-03-30T11:49:43.139Z',
        events: [],
        costs: [],
      } as any)
      .mockResolvedValueOnce({
        id: 'task-2',
        projectId: 'project-1',
        type: 'summary',
        status: 'completed',
        input: {},
        result: {
          content: JSON.stringify({
            title: '已完成综述',
            overview: '结果已就绪',
          }),
        },
        progress: 100,
        createdAt: '2026-03-30T11:47:54.764Z',
        updatedAt: '2026-03-30T11:49:43.139Z',
        events: [],
        costs: [],
      } as any)
    mockGetTaskStatus.mockResolvedValue({
      status: 'processing',
      stage: 'generating_models',
      progress: {
        percentage: 60,
      },
      message: '正在生成中',
    } as any)
    mockUseTaskProgressPolling.mockReturnValue({
      progress: {
        status: 'completed',
        stage: 'completed',
        progress: {
          percentage: 100,
        },
        message: '✅ 任务完成',
      } as any,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      startPolling: jest.fn(),
      stopPolling: jest.fn(),
    })

    render(<SummaryPage />)

    await waitFor(() => {
      expect(screen.getByTestId('summary-result')).toBeInTheDocument()
    })
  })
})
