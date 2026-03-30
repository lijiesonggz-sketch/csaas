import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ActionPlanPage from '../page'
import { useParams, useSearchParams, useRouter } from 'next/navigation'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/lib/api/ai-tasks', () => ({
  AITasksAPI: {
    getTasksByProject: jest.fn().mockResolvedValue([]),
    getTask: jest.fn(),
    getActionPlanMeasures: jest.fn(),
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

jest.mock('@/components/features/ActionPlanResultDisplay', () => ({
  __esModule: true,
  default: () => <div data-testid="action-plan-result">Action Plan Result Display</div>,
}))

jest.mock('@/components/projects/RollbackButton', () => ({
  __esModule: true,
  default: () => <button>Rollback</button>,
}))

jest.mock('@/components/features/MaturityRadarChart', () => ({
  __esModule: true,
  default: () => <div data-testid="radar-chart">Radar Chart</div>,
  RADAR_DIMENSIONS: [],
}))

describe('ActionPlanPage', () => {
  const mockBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({ projectId: 'project-1' })
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams())
    ;(useRouter as jest.Mock).mockReturnValue({ back: mockBack, push: jest.fn() })
  })

  it('renders the current title and target-maturity generation state', async () => {
    render(<ActionPlanPage />)

    expect(await screen.findByText('生成新的改进措施')).toBeInTheDocument()
    expect(screen.getByText('改进措施')).toBeInTheDocument()
    expect(screen.getByText('生成措施')).toBeInTheDocument()
  })

  it('renders the current cancel action for the regenerate form', async () => {
    render(<ActionPlanPage />)

    expect(await screen.findByRole('button', { name: /取消重新生成/ })).toBeInTheDocument()
  })
})
