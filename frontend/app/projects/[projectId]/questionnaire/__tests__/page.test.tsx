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

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
}

jest.mock('@/lib/hooks/useAITaskCache', () => ({
  useAITaskCache: jest.fn(() => mockCache),
}))

// Mock components
jest.mock('@/components/features/QuestionnaireResultDisplay', () => ({
  __esModule: true,
  default: ({ result, editable, questions, onQuestionsChange }: any) => {
    const sourceQuestions = questions || result?.selectedResult?.questionnaire || []

    return (
      <div data-testid="questionnaire-result">
        {editable ? 'editable' : 'readonly'}
        <span>{sourceQuestions.length} questions</span>
        <button
          onClick={() =>
            onQuestionsChange?.(
              sourceQuestions.map((question: any) => ({
                ...question,
                question_text: '已编辑的问题文本',
              }))
            )
          }
        >
          修改问卷
        </button>
      </div>
    )
  },
}))

jest.mock('@/components/features/QuestionnaireProgressDisplay', () => ({
  QuestionnaireProgressDisplay: ({ taskStatus }: { taskStatus?: string }) => (
    <div data-testid="progress-display" data-task-status={taskStatus}>
      Progress Display
    </div>
  ),
}))

jest.mock('@/components/projects/RerunTaskDialog', () => ({
  __esModule: true,
  default: ({ open }: any) => (open ? <div data-testid="rerun-dialog">Rerun Dialog</div> : null),
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
    saveProjectQuestionnaireSnapshotDraft: jest.fn(),
    publishProjectQuestionnaireSnapshot: jest.fn(),
    getProjectQuestionnairePublishImpact: jest.fn(),
    getQuestionnaireFreshness: jest.fn(),
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
    mockCache.get.mockReset()
    mockCache.set.mockReset()
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
    SurveyAPI.getProjectQuestionnaireSnapshot.mockRejectedValue({
      status: 404,
      message: 'not found',
    })
    SurveyAPI.saveProjectQuestionnaireSnapshotDraft.mockResolvedValue(undefined)
    SurveyAPI.publishProjectQuestionnaireSnapshot.mockResolvedValue(undefined)
    SurveyAPI.getProjectQuestionnairePublishImpact.mockResolvedValue({
      projectId: 'project-1',
      questionnaireTaskId: 'draft-task-1',
      publishedSnapshotTaskId: 'snapshot-task-1',
      requiresDownstreamRefresh: true,
      staleTargets: ['gap-analysis', 'action-plan', 'report'],
      changeTypes: ['question_added'],
      message: '现有差距分析、行动计划和报告需重新生成。',
    })
    SurveyAPI.getQuestionnaireFreshness.mockResolvedValue({
      projectId: 'project-1',
      surveyResponseId: 'survey-response-id',
      questionnaireTaskId: 'snapshot-task-1',
      latestPublishedSnapshotTaskId: 'snapshot-task-1',
      isStale: false,
      staleTargets: [],
      changeTypes: [],
      message: null,
    })
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

  it('should generate the project questionnaire from the latest completed matrix task instead of KG snapshot', async () => {
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
      lifecycleStatus: 'published',
      publishedSnapshotTaskId: 'snapshot-task-1',
      baseSnapshotTaskId: null,
      editVersion: 0,
      lastEditedAt: '2026-03-26T10:00:00.000Z',
      lastEditedBy: null,
      questions: [
        {
          question_id: 'Q-KG-001',
          question_template_id: 'question-yes-no',
          control_id: 'ctrl-1',
          cluster_id: 'ctrl-1',
          cluster_name: 'KG 通用控制点',
          question_text: '这是组织级通用题库问题',
          question_type: 'SINGLE_CHOICE',
          options: [
            { option_id: 'A', text: '已建立', score: 5 },
            { option_id: 'B', text: '未建立', score: 0 },
          ],
          required: true,
          guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
          display_order: 1,
          scoring_rule: null,
          is_project_custom: false,
        },
      ],
    })
    AITasksAPI.getTasksByProject.mockResolvedValue([
      {
        id: 'kg-snapshot-task',
        type: 'questionnaire',
        status: 'completed',
        createdAt: '2026-03-26T12:00:00.000Z',
        input: { snapshotKind: 'kg_dynamic_questionnaire' },
        result: { snapshotKind: 'kg_dynamic_questionnaire' },
      },
      {
        id: 'matrix-task-new',
        type: 'matrix',
        status: 'completed',
        createdAt: '2026-03-26T11:00:00.000Z',
        result: { matrix: [{ cluster_id: 'cluster-1', cluster_name: 'AIMM 能力项' }] },
      },
      {
        id: 'matrix-task-old',
        type: 'matrix',
        status: 'completed',
        createdAt: '2026-03-26T10:00:00.000Z',
        result: { matrix: [{ cluster_id: 'cluster-old', cluster_name: '旧矩阵' }] },
      },
    ])
    AITasksAPI.createTask.mockResolvedValue({
      id: 'questionnaire-task-1',
      projectId: 'project-1',
      type: 'questionnaire',
      status: 'pending',
      input: { matrixTaskId: 'matrix-task-new' },
      result: null,
      progress: 0,
      createdAt: '2026-03-26T12:30:00.000Z',
      updatedAt: '2026-03-26T12:30:00.000Z',
    })

    render(<QuestionnairePage />)

    await waitFor(() => {
      expect(screen.getByText('生成问卷')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('生成问卷'))

    await waitFor(() => {
      expect(AITasksAPI.createTask).toHaveBeenCalledWith({
        projectId: 'project-1',
        type: 'questionnaire',
        input: { matrixTaskId: 'matrix-task-new' },
      })
    })
    expect(SurveyAPI.createProjectQuestionnaireSnapshot).not.toHaveBeenCalled()
  })

  it('should ignore stale matrix questionnaires that were generated from an older matrix task', async () => {
    AITasksAPI.getTasksByProject.mockResolvedValue([
      {
        id: 'questionnaire-from-old-matrix',
        type: 'questionnaire',
        status: 'completed',
        createdAt: '2026-03-26T12:00:00.000Z',
        input: { matrixTaskId: 'matrix-task-old' },
        result: {
          questionnaire: [
            {
              question_id: 'Q001',
              cluster_id: 'old-cluster',
              cluster_name: '旧矩阵能力项',
              question_text: '旧矩阵生成的问题',
              question_type: 'SINGLE_CHOICE',
              options: [],
              required: true,
              guidance: '',
            },
          ],
          questionnaire_metadata: { total_questions: 1 },
        },
      },
      {
        id: 'matrix-task-new',
        type: 'matrix',
        status: 'completed',
        createdAt: '2026-03-26T11:00:00.000Z',
        result: { matrix: [{ cluster_id: 'cluster-1', cluster_name: '最新 AIMM 能力项' }] },
      },
      {
        id: 'matrix-task-old',
        type: 'matrix',
        status: 'completed',
        createdAt: '2026-03-26T10:00:00.000Z',
        result: { matrix: [{ cluster_id: 'old-cluster', cluster_name: '旧矩阵能力项' }] },
      },
    ])
    AITasksAPI.createTask.mockResolvedValue({
      id: 'questionnaire-task-1',
      projectId: 'project-1',
      type: 'questionnaire',
      status: 'pending',
      input: { matrixTaskId: 'matrix-task-new' },
      result: null,
      progress: 0,
      createdAt: '2026-03-26T12:30:00.000Z',
      updatedAt: '2026-03-26T12:30:00.000Z',
    })

    render(<QuestionnairePage />)

    await waitFor(() => {
      expect(screen.getByText('生成问卷')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('questionnaire-result')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('生成问卷'))

    await waitFor(() => {
      expect(AITasksAPI.createTask).toHaveBeenCalledWith({
        projectId: 'project-1',
        type: 'questionnaire',
        input: { matrixTaskId: 'matrix-task-new' },
      })
    })
  })

  it('should show an in-progress questionnaire task instead of the empty generate state', async () => {
    AITasksAPI.getTasksByProject.mockResolvedValue([
      {
        id: 'questionnaire-running-task',
        projectId: 'project-1',
        type: 'questionnaire',
        status: 'processing',
        createdAt: '2026-03-26T12:00:00.000Z',
        updatedAt: '2026-03-26T12:05:00.000Z',
        input: { matrixTaskId: 'matrix-task-new' },
        result: null,
        progress: 35,
        clusterGenerationStatus: {
          totalClusters: 2,
          completedClusters: ['cluster-1__row_1'],
          failedClusters: [],
          pendingClusters: ['cluster-2__row_2'],
          clusterProgress: {
            'cluster-1__row_1': {
              clusterId: 'cluster-1__row_1',
              clusterName: '能力项一',
              status: 'completed',
              questionsGenerated: 5,
              questionsExpected: 5,
            },
            'cluster-2__row_2': {
              clusterId: 'cluster-2__row_2',
              clusterName: '能力项二',
              status: 'generating',
              questionsGenerated: 0,
              questionsExpected: 5,
            },
          },
        },
      },
      {
        id: 'matrix-task-new',
        type: 'matrix',
        status: 'completed',
        createdAt: '2026-03-26T11:00:00.000Z',
        result: { matrix: [{ cluster_id: 'cluster-1', cluster_name: '最新 AIMM 能力项' }] },
      },
    ])

    render(<QuestionnairePage />)

    await waitFor(() => {
      expect(screen.getByTestId('progress-display')).toHaveAttribute(
        'data-task-status',
        'processing'
      )
    })

    expect(screen.getByText('问卷正在生成中')).toBeInTheDocument()
    expect(screen.queryByText('还没有生成问卷')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^生成问卷$/ })).not.toBeInTheDocument()
  })

  it('should still show persisted questions when the newest questionnaire task failed without a result', async () => {
    AITasksAPI.getTasksByProject.mockResolvedValue([
      {
        id: 'failed-progress-only-task',
        projectId: 'project-1',
        type: 'questionnaire',
        status: 'failed',
        createdAt: '2026-03-26T12:10:00.000Z',
        updatedAt: '2026-03-26T12:20:00.000Z',
        errorMessage: '问卷生成任务已中断',
        input: { matrixTaskId: 'matrix-task-new' },
        result: null,
        progress: 35,
        clusterGenerationStatus: {
          totalClusters: 2,
          completedClusters: ['cluster-1__row_1'],
          failedClusters: [],
          pendingClusters: ['cluster-2__row_2'],
          clusterProgress: {
            'cluster-1__row_1': {
              clusterId: 'cluster-1__row_1',
              clusterName: '能力项一',
              status: 'completed',
              questionsGenerated: 5,
              questionsExpected: 5,
            },
          },
        },
      },
      {
        id: 'completed-questionnaire-task',
        projectId: 'project-1',
        type: 'questionnaire',
        status: 'completed',
        createdAt: '2026-03-26T12:00:00.000Z',
        updatedAt: '2026-03-26T12:05:00.000Z',
        input: { matrixTaskId: 'matrix-task-new', targetClusters: ['cluster-1'] },
        result: {
          questionnaire: [
            {
              question_id: 'Q001',
              cluster_id: 'cluster-1',
              cluster_name: '能力项一',
              question_text: '已生成的问题',
              question_type: 'SINGLE_CHOICE',
              options: [],
              required: true,
              guidance: '',
            },
          ],
          questionnaire_metadata: { total_questions: 1 },
        },
      },
      {
        id: 'matrix-task-new',
        type: 'matrix',
        status: 'completed',
        createdAt: '2026-03-26T11:00:00.000Z',
        result: { matrix: [{ cluster_id: 'cluster-1', cluster_name: '最新 AIMM 能力项' }] },
      },
    ])

    render(<QuestionnairePage />)

    await waitFor(() => {
      expect(screen.getByTestId('questionnaire-result')).toHaveTextContent('1 questions')
    })
    expect(screen.getByTestId('progress-display')).toHaveAttribute('data-task-status', 'failed')
    expect(screen.getByText('问卷生成任务已中断')).toBeInTheDocument()
  })

  it('should prefer questionnaire snapshot when KG source is explicitly requested', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('source=kg'))
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
      lifecycleStatus: 'published',
      publishedSnapshotTaskId: 'snapshot-task-1',
      baseSnapshotTaskId: null,
      editVersion: 0,
      lastEditedAt: '2026-03-26T10:00:00.000Z',
      lastEditedBy: null,
      questions: [
        {
          question_id: 'Q-ACC-001',
          question_template_id: 'question-yes-no',
          control_id: 'ctrl-1',
          cluster_id: 'ctrl-1',
          cluster_name: '访问控制',
          question_text: '机构是否建立特权账号定期复核机制？',
          question_type: 'SINGLE_CHOICE',
          options: [
            { option_id: 'A', text: '已建立', score: 5 },
            { option_id: 'B', text: '未建立', score: 0 },
          ],
          required: true,
          guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
          display_order: 1,
          scoring_rule: null,
          is_project_custom: false,
        },
      ],
    })

    render(<QuestionnairePage />)

    await waitFor(() => {
      expect(screen.getByText(/KG 快照 v2, 复用现有版本/)).toBeInTheDocument()
    })
    expect(screen.getByText('开始编辑')).toBeInTheDocument()
    expect(screen.getByTestId('questionnaire-result')).toHaveTextContent('readonly')

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

  it('should save questionnaire draft and clear dirty state', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('source=kg'))
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
      lifecycleStatus: 'published',
      publishedSnapshotTaskId: 'snapshot-task-1',
      baseSnapshotTaskId: null,
      editVersion: 0,
      lastEditedAt: '2026-03-26T10:00:00.000Z',
      lastEditedBy: null,
      questions: [
        {
          question_id: 'Q-ACC-001',
          question_template_id: 'question-yes-no',
          control_id: 'ctrl-1',
          cluster_id: 'ctrl-1',
          cluster_name: '访问控制',
          question_text: '机构是否建立特权账号定期复核机制？',
          question_type: 'SINGLE_CHOICE',
          options: [
            { option_id: 'A', text: '已建立', score: 5 },
            { option_id: 'B', text: '未建立', score: 0 },
          ],
          required: true,
          guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
          display_order: 1,
          scoring_rule: null,
          is_project_custom: false,
        },
      ],
    })
    SurveyAPI.saveProjectQuestionnaireSnapshotDraft.mockResolvedValue({
      projectId: 'project-1',
      organizationId: 'org-1',
      questionnaireTaskId: 'draft-task-1',
      generatedAt: '2026-03-31T10:00:00.000Z',
      snapshotVersion: 3,
      resolvedControlSetVersion: 'resolved-controls@2026-03-26T10:00:00.000Z',
      questionSetVersion: 'question-set@2026-03-26T10:00:00.000Z',
      sourceControlIds: ['ctrl-1'],
      missingQuestionControlIds: [],
      reusedExisting: false,
      lifecycleStatus: 'draft',
      publishedSnapshotTaskId: 'snapshot-task-1',
      baseSnapshotTaskId: 'snapshot-task-1',
      editVersion: 1,
      lastEditedAt: '2026-03-31T10:00:00.000Z',
      lastEditedBy: 'user-1',
      questions: [
        {
          question_id: 'Q-ACC-001',
          question_template_id: 'question-yes-no',
          control_id: 'ctrl-1',
          cluster_id: 'ctrl-1',
          cluster_name: '访问控制',
          question_text: '已编辑的问题文本',
          question_type: 'SINGLE_CHOICE',
          options: [
            { option_id: 'A', text: '已建立', score: 5 },
            { option_id: 'B', text: '未建立', score: 0 },
          ],
          required: true,
          guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
          display_order: 1,
          scoring_rule: null,
          is_project_custom: false,
        },
      ],
    })

    render(<QuestionnairePage />)

    await waitFor(() => expect(screen.getByText('开始编辑')).toBeInTheDocument())

    fireEvent.click(screen.getByText('开始编辑'))
    fireEvent.click(screen.getByText('修改问卷'))

    expect(screen.getByText('未保存修改')).toBeInTheDocument()

    fireEvent.click(screen.getByText('保存草稿'))

    await waitFor(() => {
      expect(SurveyAPI.saveProjectQuestionnaireSnapshotDraft).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.queryByText('未保存修改')).not.toBeInTheDocument()
      expect(screen.getByText('草稿')).toBeInTheDocument()
    })
  })

  it('should publish questionnaire after persisting local changes', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('source=kg'))
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
      lifecycleStatus: 'published',
      publishedSnapshotTaskId: 'snapshot-task-1',
      baseSnapshotTaskId: null,
      editVersion: 0,
      lastEditedAt: '2026-03-26T10:00:00.000Z',
      lastEditedBy: null,
      questions: [
        {
          question_id: 'Q-ACC-001',
          question_template_id: 'question-yes-no',
          control_id: 'ctrl-1',
          cluster_id: 'ctrl-1',
          cluster_name: '访问控制',
          question_text: '机构是否建立特权账号定期复核机制？',
          question_type: 'SINGLE_CHOICE',
          options: [
            { option_id: 'A', text: '已建立', score: 5 },
            { option_id: 'B', text: '未建立', score: 0 },
          ],
          required: true,
          guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
          display_order: 1,
          scoring_rule: null,
          is_project_custom: false,
        },
      ],
    })
    SurveyAPI.saveProjectQuestionnaireSnapshotDraft.mockResolvedValue({
      projectId: 'project-1',
      organizationId: 'org-1',
      questionnaireTaskId: 'draft-task-1',
      generatedAt: '2026-03-31T10:00:00.000Z',
      snapshotVersion: 3,
      resolvedControlSetVersion: 'resolved-controls@2026-03-26T10:00:00.000Z',
      questionSetVersion: 'question-set@2026-03-26T10:00:00.000Z',
      sourceControlIds: ['ctrl-1'],
      missingQuestionControlIds: [],
      reusedExisting: false,
      lifecycleStatus: 'draft',
      publishedSnapshotTaskId: 'snapshot-task-1',
      baseSnapshotTaskId: 'snapshot-task-1',
      editVersion: 1,
      lastEditedAt: '2026-03-31T10:00:00.000Z',
      lastEditedBy: 'user-1',
      questions: [
        {
          question_id: 'Q-ACC-001',
          question_template_id: 'question-yes-no',
          control_id: 'ctrl-1',
          cluster_id: 'ctrl-1',
          cluster_name: '访问控制',
          question_text: '已编辑的问题文本',
          question_type: 'SINGLE_CHOICE',
          options: [
            { option_id: 'A', text: '已建立', score: 5 },
            { option_id: 'B', text: '未建立', score: 0 },
          ],
          required: true,
          guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
          display_order: 1,
          scoring_rule: null,
          is_project_custom: false,
        },
      ],
    })
    SurveyAPI.publishProjectQuestionnaireSnapshot.mockResolvedValue({
      projectId: 'project-1',
      organizationId: 'org-1',
      questionnaireTaskId: 'draft-task-1',
      generatedAt: '2026-03-31T10:05:00.000Z',
      snapshotVersion: 3,
      resolvedControlSetVersion: 'resolved-controls@2026-03-26T10:00:00.000Z',
      questionSetVersion: 'question-set@2026-03-26T10:00:00.000Z',
      sourceControlIds: ['ctrl-1'],
      missingQuestionControlIds: [],
      reusedExisting: false,
      lifecycleStatus: 'published',
      publishedSnapshotTaskId: 'draft-task-1',
      baseSnapshotTaskId: 'snapshot-task-1',
      editVersion: 1,
      lastEditedAt: '2026-03-31T10:05:00.000Z',
      lastEditedBy: 'user-1',
      questions: [
        {
          question_id: 'Q-ACC-001',
          question_template_id: 'question-yes-no',
          control_id: 'ctrl-1',
          cluster_id: 'ctrl-1',
          cluster_name: '访问控制',
          question_text: '已编辑的问题文本',
          question_type: 'SINGLE_CHOICE',
          options: [
            { option_id: 'A', text: '已建立', score: 5 },
            { option_id: 'B', text: '未建立', score: 0 },
          ],
          required: true,
          guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
          display_order: 1,
          scoring_rule: null,
          is_project_custom: false,
        },
      ],
    })

    render(<QuestionnairePage />)

    await waitFor(() => expect(screen.getByText('开始编辑')).toBeInTheDocument())

    fireEvent.click(screen.getByText('开始编辑'))
    fireEvent.click(screen.getByText('修改问卷'))
    fireEvent.click(screen.getByText('发布问卷'))

    await waitFor(() => {
      expect(SurveyAPI.getProjectQuestionnairePublishImpact).toHaveBeenCalledWith('project-1')
    })
    expect(screen.getByText('确认重新发布问卷')).toBeInTheDocument()
    fireEvent.click(screen.getByText('确认发布'))

    await waitFor(() => {
      expect(SurveyAPI.saveProjectQuestionnaireSnapshotDraft).toHaveBeenCalled()
      expect(SurveyAPI.publishProjectQuestionnaireSnapshot).toHaveBeenCalledWith('project-1')
    })
    expect(screen.getByText('已发布')).toBeInTheDocument()
    expect(screen.getByTestId('questionnaire-result')).toHaveTextContent('readonly')
  })

  it('should show leave confirmation when there are unsaved changes', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('source=kg'))
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
      lifecycleStatus: 'published',
      publishedSnapshotTaskId: 'snapshot-task-1',
      baseSnapshotTaskId: null,
      editVersion: 0,
      lastEditedAt: '2026-03-26T10:00:00.000Z',
      lastEditedBy: null,
      questions: [
        {
          question_id: 'Q-ACC-001',
          question_template_id: 'question-yes-no',
          control_id: 'ctrl-1',
          cluster_id: 'ctrl-1',
          cluster_name: '访问控制',
          question_text: '机构是否建立特权账号定期复核机制？',
          question_type: 'SINGLE_CHOICE',
          options: [
            { option_id: 'A', text: '已建立', score: 5 },
            { option_id: 'B', text: '未建立', score: 0 },
          ],
          required: true,
          guidance: '此题为必答题，请选择最符合当前控制现状的选项。',
          display_order: 1,
          scoring_rule: null,
          is_project_custom: false,
        },
      ],
    })

    render(<QuestionnairePage />)

    await waitFor(() => expect(screen.getByText('开始编辑')).toBeInTheDocument())

    fireEvent.click(screen.getByText('开始编辑'))
    fireEvent.click(screen.getByText('修改问卷'))
    fireEvent.click(screen.getByText('返回'))

    expect(screen.getByText('检测到未保存修改')).toBeInTheDocument()

    fireEvent.click(screen.getByText('放弃修改'))

    expect(mockBack).toHaveBeenCalledTimes(1)
  })
})
