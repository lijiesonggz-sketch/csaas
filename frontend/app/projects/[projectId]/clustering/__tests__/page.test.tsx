import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ClusteringPage from '../page'
import { useParams, useRouter } from 'next/navigation'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

const mockProjectContext = {
  project: {
    id: 'project-1',
    metadata: {
      uploadedDocuments: [{ id: 'doc-1', name: 'Test Doc', content: 'test content' }],
    },
  },
}

jest.mock('@/lib/contexts/ProjectContext', () => ({
  useProject: jest.fn(() => mockProjectContext),
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
})
