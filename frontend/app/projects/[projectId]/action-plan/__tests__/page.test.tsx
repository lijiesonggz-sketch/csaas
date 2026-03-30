import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ActionPlanPage from '../page'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { getRemediationPriorityList } from '@/lib/api/report-center'
import { SurveyAPI } from '@/lib/api/survey'

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

jest.mock('@/lib/api/report-center', () => ({
  getRemediationPriorityList: jest.fn(),
}))

jest.mock('@/lib/api/survey', () => ({
  SurveyAPI: {
    getQuestionnaireFreshness: jest.fn(),
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
  const mockGetRemediationPriorityList = getRemediationPriorityList as jest.MockedFunction<
    typeof getRemediationPriorityList
  >
  const mockGetQuestionnaireFreshness = SurveyAPI.getQuestionnaireFreshness as jest.MockedFunction<
    typeof SurveyAPI.getQuestionnaireFreshness
  >

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({ projectId: 'project-1' })
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams())
    ;(useRouter as jest.Mock).mockReturnValue({ back: mockBack, push: jest.fn() })
    mockGetQuestionnaireFreshness.mockResolvedValue({
      projectId: 'project-1',
      surveyResponseId: 'survey-1',
      questionnaireTaskId: 'task-1',
      latestPublishedSnapshotTaskId: 'task-1',
      isStale: false,
      staleTargets: [],
      changeTypes: [],
      message: null,
    })
    mockGetRemediationPriorityList.mockResolvedValue({
      reportId: 'survey-1',
      items: [
        {
          rank: 1,
          controlId: 'control-1',
          remediationActionId: 'action-1',
          controlCode: 'CTRL-001',
          controlName: '账号权限最小化',
          l1Code: 'IT01',
          l1Name: '身份安全',
          l2Code: 'IT01-01',
          l2Name: '账户治理',
          riskLevel: 'HIGH',
          difficultyLevel: 'medium',
          priorityScore: 6,
          statusLabel: '已有整改建议',
          title: '补齐权限复核流程',
          description: '建立每季度权限复核记录',
          expectedBenefit: '降低超权访问风险',
        },
      ],
    })
  })

  it('renders the current title and target-maturity generation state', async () => {
    render(<ActionPlanPage />)

    expect(await screen.findByText('生成新的改进措施')).toBeInTheDocument()
    expect(screen.getByText('改进措施')).toBeInTheDocument()
    expect(screen.getByText('生成措施')).toBeInTheDocument()
    expect(screen.getByText('整改优先级清单')).toBeInTheDocument()
  })

  it('renders the current cancel action for the regenerate form', async () => {
    render(<ActionPlanPage />)

    expect(await screen.findByRole('button', { name: /取消重新生成/ })).toBeInTheDocument()
  })

  it('shows a stale alert and regenerate entry when questionnaire freshness is stale', async () => {
    ;(useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('surveyResponseId=survey-1&targetMaturity=4'),
    )
    const mockPush = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ back: mockBack, push: mockPush })
    mockGetQuestionnaireFreshness.mockResolvedValue({
      projectId: 'project-1',
      surveyResponseId: 'survey-1',
      questionnaireTaskId: 'task-1',
      latestPublishedSnapshotTaskId: 'task-2',
      isStale: true,
      staleTargets: ['action-plan'],
      changeTypes: ['question_added'],
      message: '现有差距分析、行动计划和报告需重新生成。',
    })

    render(<ActionPlanPage />)

    expect(await screen.findByText('当前改进措施结果已失效')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /前往差距分析重新生成/ }))
    expect(mockPush).toHaveBeenCalledWith('/projects/project-1/gap-analysis')
  })
})
