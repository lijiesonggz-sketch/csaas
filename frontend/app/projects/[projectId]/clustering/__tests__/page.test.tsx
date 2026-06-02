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

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({ projectId: 'project-1' })
    ;(useRouter as jest.Mock).mockReturnValue({ back: mockBack })
    ;(useProject as jest.Mock).mockReturnValue({
      project: {
        id: 'project-1',
        metadata: {
          uploadedDocuments: [{ id: 'doc-1', name: 'Test Doc', content: 'test content' }],
        },
      },
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
  })
})
