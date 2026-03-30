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
})
