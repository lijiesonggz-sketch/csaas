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
})
