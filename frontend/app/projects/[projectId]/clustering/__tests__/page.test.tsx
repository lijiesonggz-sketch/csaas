import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ClusteringPage from '../page'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/utils/api'
import { AITasksAPI } from '@/lib/api/ai-tasks'
import { useProject } from '@/lib/contexts/ProjectContext'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/lib/contexts/ProjectContext', () => ({
  useProject: jest.fn(),
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

jest.mock('@/components/features/ClusteringResultDisplay', () => ({
  __esModule: true,
  default: () => <div data-testid="clustering-result">Clustering Result Display</div>,
}))

describe('ClusteringPage', () => {
  const mockBack = jest.fn()
  const mockRefreshProject = jest.fn()
  const structuredDocumentContent = [
    '5 人工智能治理',
    '5.1 战略管理',
    '5.1.2 过程描述',
    'a) 利益相关者分析，明确利益相关者的需求；',
    'b) 战略需求评估，明确人工智能战略需求范围；',
  ].join('\n')

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({ projectId: 'project-1' })
    ;(useRouter as jest.Mock).mockReturnValue({ back: mockBack })
    mockRefreshProject.mockResolvedValue(undefined)
    ;(useProject as jest.Mock).mockReturnValue({
      project: {
        id: 'project-1',
        metadata: {
          uploadedDocuments: [{ id: 'doc-1', name: 'Test Doc', content: 'test content' }],
        },
      },
      refreshProject: mockRefreshProject,
    })
    ;(apiFetch as jest.Mock).mockImplementation((endpoint: string) => {
      if (endpoint.includes('/documents/list')) {
        return Promise.resolve([])
      }
      return Promise.resolve({})
    })
    ;(AITasksAPI.createTask as jest.Mock).mockResolvedValue({ id: 'task-1' })
  })

  it('renders the current title and empty state', async () => {
    render(<ClusteringPage />)

    expect(await screen.findByText('还没有生成聚类')).toBeInTheDocument()
    expect(screen.getByText('聚类分析')).toBeInTheDocument()
    expect(screen.getByText('开始生成')).toBeInTheDocument()
  })

  it('navigates back from the current header action', async () => {
    render(<ClusteringPage />)

    fireEvent.click(await screen.findByRole('button', { name: /返回/ }))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('uses the project document list API when context metadata has no uploaded documents', async () => {
    ;(useProject as jest.Mock).mockReturnValue({
      project: {
        id: 'project-1',
        metadata: {},
      },
      refreshProject: mockRefreshProject,
    })
    ;(apiFetch as jest.Mock).mockImplementation((endpoint: string) => {
      if (endpoint.includes('/documents/list')) {
        return Promise.resolve([
          {
            id: 'doc-table-1',
            name: 'GB/T 33136',
            filename: 'GBT+33136-2024.pdf',
            size: 8186606,
            charCount: 66464,
            createdAt: '2026-06-02T06:13:44.796Z',
          },
        ])
      }
      return Promise.resolve({})
    })

    render(<ClusteringPage />)

    fireEvent.click(await screen.findByRole('button', { name: /开始生成/ }))

    await waitFor(() => {
      expect(AITasksAPI.createTask).toHaveBeenCalledWith({
        projectId: 'project-1',
        type: 'clustering',
        input: {
          documentIds: ['doc-table-1'],
          maxTokens: 60000,
          clusteringMode: 'ai',
        },
      })
    })

    expect(apiFetch).toHaveBeenCalledWith('/projects/project-1', {
      method: 'PATCH',
      body: JSON.stringify({
        metadata: {
          clusteringTaskId: 'task-1',
        },
      }),
    })
    expect(mockRefreshProject).toHaveBeenCalledTimes(1)
  })

  it('加载保存结果时优先使用后端最新项目 metadata，避免返回后读到旧任务', async () => {
    ;(useProject as jest.Mock).mockReturnValue({
      project: {
        id: 'project-1',
        metadata: {
          clusteringTaskId: 'old-task',
          uploadedDocuments: [{ id: 'doc-1', name: 'Test Doc', content: 'test content' }],
        },
      },
      refreshProject: mockRefreshProject,
    })
    ;(apiFetch as jest.Mock).mockImplementation((endpoint: string) => {
      if (endpoint.includes('/documents/list')) {
        return Promise.resolve([])
      }
      if (endpoint === '/projects/project-1') {
        return Promise.resolve({
          id: 'project-1',
          metadata: {
            clusteringTaskId: 'new-task',
          },
        })
      }
      return Promise.resolve({})
    })
    ;(AITasksAPI.getTask as jest.Mock).mockResolvedValue({
      id: 'new-task',
      projectId: 'project-1',
      type: 'clustering',
      status: 'completed',
      result: {
        categories: [],
        clustering_logic: 'new result',
        coverage_summary: {
          by_document: {},
          overall: { total_clauses: 0, clustered_clauses: 0, coverage_rate: 0 },
        },
      },
    })

    render(<ClusteringPage />)

    await waitFor(() => {
      expect(AITasksAPI.getTask).toHaveBeenCalledWith('new-task')
    })
    expect(AITasksAPI.getTask).not.toHaveBeenCalledWith('old-task')
    expect(await screen.findByTestId('clustering-result')).toBeInTheDocument()
  })

  it('结构化单文档默认推荐按原始层级生成并传递 structured 模式', async () => {
    ;(useProject as jest.Mock).mockReturnValue({
      project: {
        id: 'project-1',
        metadata: {
          uploadedDocuments: [
            {
              id: 'doc-structured',
              name: 'AIMM标准',
              content: structuredDocumentContent,
            },
          ],
        },
      },
      refreshProject: mockRefreshProject,
    })

    render(<ClusteringPage />)

    expect(await screen.findByText(/检测到结构化标准/)).toBeInTheDocument()
    expect(screen.getByText(/识别出 2 个叶子要求项/)).toBeInTheDocument()
    expect(screen.getByLabelText(/按原始层级生成/)).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: /开始生成/ }))

    await waitFor(() => {
      expect(AITasksAPI.createTask).toHaveBeenCalledWith({
        projectId: 'project-1',
        type: 'clustering',
        input: {
          documentIds: ['doc-structured'],
          maxTokens: 60000,
          clusteringMode: 'structured',
        },
      })
    })
  })

  it('用户可以改选AI语义聚类并传递 ai 模式', async () => {
    ;(useProject as jest.Mock).mockReturnValue({
      project: {
        id: 'project-1',
        metadata: {
          uploadedDocuments: [
            {
              id: 'doc-structured',
              name: 'AIMM标准',
              content: structuredDocumentContent,
            },
          ],
        },
      },
      refreshProject: mockRefreshProject,
    })

    render(<ClusteringPage />)

    fireEvent.click(await screen.findByLabelText(/AI语义聚类/))
    fireEvent.click(screen.getByRole('button', { name: /开始生成/ }))

    await waitFor(() => {
      expect(AITasksAPI.createTask).toHaveBeenCalledWith({
        projectId: 'project-1',
        type: 'clustering',
        input: {
          documentIds: ['doc-structured'],
          maxTokens: 60000,
          clusteringMode: 'ai',
        },
      })
    })
  })
})
