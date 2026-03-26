import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QuestionnairePage from '../page'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AITasksAPI } from '@/lib/api/ai-tasks'
import { SurveyAPI } from '@/lib/api/survey'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

jest.mock('@/lib/api/ai-tasks', () => ({
  AITasksAPI: {
    getTasksByProject: jest.fn(),
    createTask: jest.fn(),
    getClusterGenerationStatus: jest.fn(),
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

// Mock components
jest.mock('@/components/features/QuestionnaireResultDisplay', () => ({
  __esModule: true,
  default: ({ result }: any) => (
    <div data-testid="questionnaire-result">Questionnaire Result Display</div>
  ),
}))

jest.mock('@/components/features/QuestionnaireProgressDisplay', () => ({
  QuestionnaireProgressDisplay: () => <div data-testid="progress-display">Progress Display</div>,
}))

jest.mock('@/components/projects/RerunTaskDialog', () => ({
  __esModule: true,
  default: ({ open }: any) =>
    open ? <div data-testid="rerun-dialog">Rerun Dialog</div> : null,
}))

jest.mock('@/components/projects/RollbackButton', () => ({
  __esModule: true,
  default: () => <button>Rollback</button>,
}))

jest.mock('@/components/organizations/ProfileCompletenessGate', () => ({
  ProfileCompletenessGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/lib/api/survey', () => ({
  SurveyAPI: {
    getProjectQuestionnaireSnapshot: jest.fn(),
    createProjectQuestionnaireSnapshot: jest.fn(),
  },
}))

const mockUseParams = useParams as jest.Mock
const mockUseSearchParams = useSearchParams as jest.Mock
const mockUseRouter = useRouter as jest.Mock
const mockUseSession = useSession as jest.Mock

describe('QuestionnairePage', () => {
  const mockBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ projectId: 'project-1' })
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    mockUseRouter.mockReturnValue({ back: mockBack, push: jest.fn() })
    mockUseSession.mockReturnValue({
      data: {
        user: {
          organizationId: 'org-1',
        },
      },
      status: 'authenticated',
    })
    SurveyAPI.getProjectQuestionnaireSnapshot.mockRejectedValue({ status: 404, message: 'not found' })
  })

  it('should render page header with correct title', () => {
    render(<QuestionnairePage />)

    expect(screen.getByText('问卷生成')).toBeInTheDocument()
    expect(screen.getByText('基于成熟度矩阵生成调研问卷')).toBeInTheDocument()
  })

  it('should show empty state initially', async () => {
    render(<QuestionnairePage />)

    await waitFor(() => {
      expect(screen.getByText('还没有生成问卷')).toBeInTheDocument()
    })
  })

  it('should navigate back when back button is clicked', async () => {
    render(<QuestionnairePage />)

    await waitFor(() => {
      expect(screen.getByText('返回')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('返回'))

    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('should render generate button', async () => {
    render(<QuestionnairePage />)

    await waitFor(() => {
      expect(screen.getByText('生成问卷')).toBeInTheDocument()
    })
  })

  it('should prefer questionnaire snapshot when it exists', async () => {
    SurveyAPI.getProjectQuestionnaireSnapshot.mockResolvedValue({
      projectId: 'project-1',
      organizationId: 'org-1',
      questionnaireTaskId: 'snapshot-task-1',
      generatedAt: '2026-03-26T10:00:00.000Z',
      snapshotVersion: 2,
      resolvedControlSetVersion: 'resolved-controls@2026-03-26T10:00:00.000Z',
      questionSetVersion: 'question-set@2026-03-26T10:00:00.000Z',
      sourceControlIds: ['ctrl-1'],
      missingQuestionControlIds: [],
      reusedExisting: true,
      questions: [],
    })

    render(<QuestionnairePage />)

    await waitFor(() => {
      expect(screen.getByText(/KG 快照 v2, 复用现有版本/)).toBeInTheDocument()
    })

    expect(AITasksAPI.getTasksByProject).not.toHaveBeenCalled()
  })

  it('should fall back to legacy questionnaire task flow when snapshot is unavailable', async () => {
    AITasksAPI.getTasksByProject.mockResolvedValue([
      {
        id: 'task-1',
        type: 'questionnaire',
        createdAt: '2026-03-26T10:00:00.000Z',
        result: {
          questionnaire: [],
        },
      },
    ])

    render(<QuestionnairePage />)

    await waitFor(() => {
      expect(screen.getByText('重新生成')).toBeInTheDocument()
    })

    expect(AITasksAPI.getTasksByProject).toHaveBeenCalledWith('project-1')
  })
})
