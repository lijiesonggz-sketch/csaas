import { SurveyAPI } from './survey'
import { apiFetch } from '../utils/api'

jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
}))

describe('SurveyAPI snapshot methods', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create project questionnaire snapshot', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({ questionnaireTaskId: 'task-1' })

    await SurveyAPI.createProjectQuestionnaireSnapshot({
      projectId: 'project-1',
      regenerate: true,
    })

    expect(apiFetch).toHaveBeenCalledWith('/survey/project-questionnaire-snapshot', {
      method: 'POST',
      body: JSON.stringify({
        projectId: 'project-1',
        regenerate: true,
      }),
    })
  })

  it('should fetch project questionnaire snapshot', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({ questionnaireTaskId: 'task-1' })

    await SurveyAPI.getProjectQuestionnaireSnapshot('project-1')

    expect(apiFetch).toHaveBeenCalledWith('/survey/project-questionnaire-snapshot/project-1')
  })

  it('should save project questionnaire snapshot draft', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({ questionnaireTaskId: 'draft-task-1' })

    await SurveyAPI.saveProjectQuestionnaireSnapshotDraft('project-1', {
      questions: [
        {
          questionId: 'Q-ACC-001',
          questionTemplateId: 'question-yes-no',
          controlId: 'control-a',
          questionType: 'SINGLE_CHOICE',
          questionText: '项目层是否建立特权账号季度复核机制？',
          options: [
            { optionId: 'A', text: '已建立', score: 5 },
            { optionId: 'B', text: '未建立', score: 0 },
          ],
          scoringRule: { passValues: ['A'] },
          required: true,
          displayOrder: 1,
        },
      ],
    })

    expect(apiFetch).toHaveBeenCalledWith('/survey/project-questionnaire-snapshot/project-1/draft', {
      method: 'PUT',
      body: JSON.stringify({
        questions: [
          {
            questionId: 'Q-ACC-001',
            questionTemplateId: 'question-yes-no',
            controlId: 'control-a',
            questionType: 'SINGLE_CHOICE',
            questionText: '项目层是否建立特权账号季度复核机制？',
            options: [
              { optionId: 'A', text: '已建立', score: 5 },
              { optionId: 'B', text: '未建立', score: 0 },
            ],
            scoringRule: { passValues: ['A'] },
            required: true,
            displayOrder: 1,
          },
        ],
      }),
    })
  })

  it('should publish project questionnaire snapshot', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({ questionnaireTaskId: 'draft-task-1' })

    await SurveyAPI.publishProjectQuestionnaireSnapshot('project-1')

    expect(apiFetch).toHaveBeenCalledWith('/survey/project-questionnaire-snapshot/project-1/publish', {
      method: 'POST',
    })
  })

  it('should fetch project questionnaire publish impact', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({ requiresDownstreamRefresh: true })

    await SurveyAPI.getProjectQuestionnairePublishImpact('project-1')

    expect(apiFetch).toHaveBeenCalledWith('/survey/project-questionnaire-snapshot/project-1/publish-impact')
  })

  it('should fetch questionnaire freshness', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({ isStale: false })

    await SurveyAPI.getQuestionnaireFreshness('survey-1')

    expect(apiFetch).toHaveBeenCalledWith('/survey/questionnaire-freshness/survey-1')
  })
})
