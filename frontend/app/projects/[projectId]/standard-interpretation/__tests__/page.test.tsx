import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import StandardInterpretationPage from '../page'
import { apiFetch } from '@/lib/utils/api'
import { AITasksAPI } from '@/lib/api/ai-tasks'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
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

jest.mock('@/lib/message', () => ({
  message: {
    success: jest.fn(),
  },
}))

const mockUseParams = useParams as jest.Mock
const mockUseRouter = useRouter as jest.Mock
const mockUseSession = useSession as jest.Mock
const mockApiFetch = apiFetch as jest.Mock
const mockPush = jest.fn()

describe('StandardInterpretationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ projectId: 'project-1' })
    mockUseRouter.mockReturnValue({
      back: jest.fn(),
      push: mockPush,
    })
  })

  it('should block protected requests and show login CTA when unauthenticated', async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(<StandardInterpretationPage />)

    expect(await screen.findByText('登录已失效')).toBeInTheDocument()
    expect(screen.getByText('请先登录后再查看或生成标准解读。')).toBeInTheDocument()
    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(AITasksAPI.getTask).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '去登录' }))
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('should load document list from apiFetch direct data payload', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
        },
      },
      status: 'authenticated',
    })

    mockApiFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('/documents/list')) {
        return [
          {
            id: 'doc-1',
            name: '标准文档.docx',
            content: 'A'.repeat(200),
          },
        ]
      }

      if (endpoint === '/projects/project-1') {
        return {
          id: 'project-1',
          name: '测试项目',
          metadata: {},
        }
      }

      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    render(<StandardInterpretationPage />)

    await waitFor(() => {
      expect(screen.getByText('已准备好 1 个文档')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: '开始解读' })).toBeEnabled()
    expect(AITasksAPI.getTask).not.toHaveBeenCalled()
  })

  it('should show saved failed task reason instead of analysis-in-progress state', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
        },
      },
      status: 'authenticated',
    })

    mockApiFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('/documents/list')) {
        return [
          {
            id: 'doc-1',
            name: '标准文档.docx',
            content: 'A'.repeat(200),
          },
        ]
      }

      if (endpoint === '/projects/project-1') {
        return {
          id: 'project-1',
          name: '测试项目',
          metadata: {
            standardInterpretationTaskId: 'failed-task-1',
          },
        }
      }

      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })
    ;(AITasksAPI.getTask as jest.Mock).mockResolvedValue({
      id: 'failed-task-1',
      status: 'failed',
      errorMessage: '标准解读任务已中断：后台执行进程停止或超过 20 分钟未更新进度，请重新生成。',
    })

    render(<StandardInterpretationPage />)

    expect(
      await screen.findByText(
        '标准解读任务已中断：后台执行进程停止或超过 20 分钟未更新进度，请重新生成。'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('分析中...')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始解读' })).toBeEnabled()
  })

  it('should start two-phase interpretation with a larger batch size', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
        },
      },
      status: 'authenticated',
    })

    const document = {
      id: 'doc-1',
      name: '标准文档.docx',
      content: '标准正文'.repeat(100),
    }

    mockApiFetch.mockImplementation(async (endpoint: string, options?: RequestInit) => {
      if (endpoint.includes('/documents/list')) {
        return [document]
      }

      if (endpoint === '/projects/project-1' && options?.method === 'PATCH') {
        return {
          id: 'project-1',
          metadata: {
            standardInterpretationTaskId: 'task-1',
          },
        }
      }

      if (endpoint === '/projects/project-1') {
        return {
          id: 'project-1',
          name: '测试项目',
          metadata: {
            uploadedDocuments: [document],
          },
        }
      }

      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })
    ;(AITasksAPI.createTask as jest.Mock).mockResolvedValue({
      id: 'task-1',
    })

    render(<StandardInterpretationPage />)

    fireEvent.click(await screen.findByRole('button', { name: '开始解读' }))

    await waitFor(() => {
      expect(AITasksAPI.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          type: 'standard_interpretation',
          input: expect.objectContaining({
            useTwoPhaseMode: true,
            batchSize: 10,
          }),
        })
      )
    })

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/projects/project-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          metadata: {
            standardInterpretationTaskId: 'task-1',
          },
        }),
      })
    )
  })
})
