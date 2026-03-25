import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AIGenerationResult, Project, SurveyResponse } from '../../database/entities'
import { ControlGapInputService } from './control-gap-input.service'

const SURVEY_RESPONSE_ID = '550e8400-e29b-41d4-a716-446655440330'
const QUESTIONNAIRE_TASK_ID = '660e8400-e29b-41d4-a716-446655440330'
const PROJECT_ID = '770e8400-e29b-41d4-a716-446655440330'
const ORG_ID = '880e8400-e29b-41d4-a716-446655440330'

describe('ControlGapInputService', () => {
  let service: ControlGapInputService

  const surveyResponseRepository = {
    findOne: jest.fn(),
  }
  const aiGenerationResultRepository = {
    findOne: jest.fn(),
  }
  const projectRepository = {
    findOne: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ControlGapInputService,
        {
          provide: getRepositoryToken(SurveyResponse),
          useValue: surveyResponseRepository,
        },
        {
          provide: getRepositoryToken(AIGenerationResult),
          useValue: aiGenerationResultRepository,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepository,
        },
      ],
    }).compile()

    service = module.get(ControlGapInputService)
    jest.clearAllMocks()
  })

  it('should aggregate completed answers into control-point gap input', async () => {
    surveyResponseRepository.findOne.mockResolvedValue({
      id: SURVEY_RESPONSE_ID,
      questionnaireTaskId: QUESTIONNAIRE_TASK_ID,
      answers: {
        'Q-ACC-001': { answer: 'A', score: 5 },
        'Q-ACC-002': { answer: 'A', score: 4 },
        'Q-DATA-001': { answer: 'B', score: 2 },
      },
      questionnaireTask: {
        projectId: PROJECT_ID,
        type: 'questionnaire',
      },
    })
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    aiGenerationResultRepository.findOne.mockResolvedValue({
      selectedResult: {
        questionnaire: [
          {
            question_id: 'Q-ACC-001',
            cluster_id: 'control-a',
            options: [
              { option_id: 'A', score: 5 },
              { option_id: 'B', score: 0 },
            ],
          },
          {
            question_id: 'Q-ACC-002',
            cluster_id: 'control-a',
            options: [
              { option_id: 'A', score: 4 },
              { option_id: 'B', score: 1 },
            ],
          },
          {
            question_id: 'Q-DATA-001',
            cluster_id: 'control-b',
            options: [
              { option_id: 'A', score: 5 },
              { option_id: 'B', score: 2 },
            ],
          },
        ],
      },
    })

    const result = await service.getControlGapInput(SURVEY_RESPONSE_ID, ORG_ID)

    expect(result).toEqual({
      surveyResponseId: SURVEY_RESPONSE_ID,
      questionnaireTaskId: QUESTIONNAIRE_TASK_ID,
      projectId: PROJECT_ID,
      controls: [
        {
          controlId: 'control-a',
          questionIds: ['Q-ACC-001', 'Q-ACC-002'],
          currentStatus: 'COMPLIANT',
          gapLevel: 'LOW',
          missingAnswers: [],
          riskHints: [],
        },
        {
          controlId: 'control-b',
          questionIds: ['Q-DATA-001'],
          currentStatus: 'PARTIAL',
          gapLevel: 'MEDIUM',
          missingAnswers: [],
          riskHints: ['Average score below compliance threshold'],
        },
      ],
    })
  })

  it('should mark missing and invalid answers without failing the whole aggregation', async () => {
    surveyResponseRepository.findOne.mockResolvedValue({
      id: SURVEY_RESPONSE_ID,
      questionnaireTaskId: QUESTIONNAIRE_TASK_ID,
      answers: {
        'Q-ACC-001': { answer: 'A' },
      },
      questionnaireTask: {
        projectId: PROJECT_ID,
        type: 'questionnaire',
      },
    })
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: ORG_ID,
    })
    aiGenerationResultRepository.findOne.mockResolvedValue({
      selectedResult: {
        questionnaire: [
          {
            question_id: 'Q-ACC-001',
            cluster_id: 'control-a',
            options: [
              { option_id: 'A', score: 5 },
              { option_id: 'B', score: 0 },
            ],
          },
          {
            question_id: 'Q-ACC-002',
            cluster_id: 'control-a',
            options: [
              { option_id: 'A', score: 5 },
              { option_id: 'B', score: 0 },
            ],
          },
        ],
      },
    })

    const result = await service.getControlGapInput(SURVEY_RESPONSE_ID, ORG_ID)

    expect(result.controls).toEqual([
      {
        controlId: 'control-a',
        questionIds: ['Q-ACC-001', 'Q-ACC-002'],
        currentStatus: 'PARTIAL',
        gapLevel: 'MEDIUM',
        missingAnswers: [
          {
            questionId: 'Q-ACC-002',
            reason: 'missing',
          },
        ],
        riskHints: ['Missing 1 answers for control control-a'],
      },
    ])
  })

  it('should reject survey responses that do not belong to the current organization context', async () => {
    surveyResponseRepository.findOne.mockResolvedValue({
      id: SURVEY_RESPONSE_ID,
      questionnaireTaskId: QUESTIONNAIRE_TASK_ID,
      answers: {},
      questionnaireTask: {
        projectId: PROJECT_ID,
        type: 'questionnaire',
      },
    })
    projectRepository.findOne.mockResolvedValue({
      id: PROJECT_ID,
      organizationId: 'another-org-id',
    })

    await expect(service.getControlGapInput(SURVEY_RESPONSE_ID, ORG_ID)).rejects.toThrow(
      'Survey response does not belong to the current organization context',
    )
  })
})
