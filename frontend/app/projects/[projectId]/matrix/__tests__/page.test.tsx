import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import MatrixPage from '../page'
import { useParams, useSearchParams, useRouter } from 'next/navigation'

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

jest.mock('@/lib/hooks/useAITaskCache', () => ({
  useAITaskCache: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}))

jest.mock('@/components/features/MatrixResultDisplay', () => ({
  __esModule: true,
  default: () => <div data-testid="matrix-result">Matrix Result Display</div>,
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
})
