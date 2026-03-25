import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { QuestionItem } from '../../../database/entities/question-item.entity'
import { PackResolverService } from './pack-resolver.service'
import { OrganizationQuestionSetService } from './organization-question-set.service'

const VALID_ORG_ID = '550e8400-e29b-41d4-a716-446655440310'

describe('OrganizationQuestionSetService', () => {
  let service: OrganizationQuestionSetService

  const questionItemRepository = {
    find: jest.fn(),
  }

  const packResolverService = {
    resolveByOrganizationId: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationQuestionSetService,
        {
          provide: PackResolverService,
          useValue: packResolverService,
        },
        {
          provide: getRepositoryToken(QuestionItem),
          useValue: questionItemRepository,
        },
      ],
    }).compile()

    service = module.get(OrganizationQuestionSetService)
    jest.clearAllMocks()
  })

  it('should aggregate active question items for resolved controls and preserve stable ordering', async () => {
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      matchedPacks: ['PACK-BASE-CYBER'],
      matchedRules: ['RULE-001'],
      controls: [
        {
          controlId: 'control-a',
          controlCode: 'CTRL-ACC-002',
        },
        {
          controlId: 'control-b',
          controlCode: 'CTRL-DATA-011',
        },
      ],
      summary: {
        totalControls: 2,
        mandatoryCount: 2,
        matchedPacks: 1,
        matchedRules: 1,
        excludedControls: 0,
      },
      debugLog: [],
    })
    questionItemRepository.find.mockResolvedValue([
      {
        questionId: 'question-optional',
        controlId: 'control-a',
        questionCode: 'Q-ACC-010',
        questionText: '是否保留特权账号审批记录？',
        questionType: 'MULTIPLE_CHOICE',
        answerSchema: null,
        scoringRule: null,
        required: false,
      },
      {
        questionId: 'question-required',
        controlId: 'control-a',
        questionCode: 'Q-ACC-001',
        questionText: '是否建立特权账号定期复核机制？',
        questionType: 'SINGLE_CHOICE',
        answerSchema: { options: ['yes', 'no'] },
        scoringRule: { mode: 'single_choice', passValues: ['yes'] },
        required: true,
      },
      {
        questionId: 'question-data',
        controlId: 'control-b',
        questionCode: 'Q-DATA-001',
        questionText: '是否建立跨境数据审批控制？',
        questionType: 'SINGLE_CHOICE',
        answerSchema: null,
        scoringRule: { mode: 'single_choice', passValues: ['implemented'] },
        required: true,
      },
    ])

    const result = await service.getForOrganization(VALID_ORG_ID)

    expect(packResolverService.resolveByOrganizationId).toHaveBeenCalledWith(VALID_ORG_ID)
    expect(questionItemRepository.find).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      organizationId: VALID_ORG_ID,
      questions: [
        {
          questionId: 'question-required',
          controlId: 'control-a',
          questionCode: 'Q-ACC-001',
          questionText: '是否建立特权账号定期复核机制？',
          questionType: 'SINGLE_CHOICE',
          answerSchema: { options: ['yes', 'no'] },
          scoringRule: { mode: 'single_choice', passValues: ['yes'] },
          required: true,
        },
        {
          questionId: 'question-optional',
          controlId: 'control-a',
          questionCode: 'Q-ACC-010',
          questionText: '是否保留特权账号审批记录？',
          questionType: 'MULTIPLE_CHOICE',
          answerSchema: null,
          scoringRule: null,
          required: false,
        },
        {
          questionId: 'question-data',
          controlId: 'control-b',
          questionCode: 'Q-DATA-001',
          questionText: '是否建立跨境数据审批控制？',
          questionType: 'SINGLE_CHOICE',
          answerSchema: null,
          scoringRule: { mode: 'single_choice', passValues: ['implemented'] },
          required: true,
        },
      ],
      missingQuestionControlIds: [],
      summary: {
        totalControls: 2,
        controlsWithQuestions: 2,
        missingQuestionControls: 0,
        totalQuestions: 3,
      },
    })
  })

  it('should surface missing question controls without failing the whole response', async () => {
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      matchedPacks: ['PACK-BASE-CYBER'],
      matchedRules: ['RULE-001'],
      controls: [
        {
          controlId: 'control-a',
          controlCode: 'CTRL-ACC-002',
        },
        {
          controlId: 'control-b',
          controlCode: 'CTRL-DATA-011',
        },
        {
          controlId: 'control-c',
          controlCode: 'CTRL-OPS-007',
        },
      ],
      summary: {
        totalControls: 3,
        mandatoryCount: 2,
        matchedPacks: 1,
        matchedRules: 1,
        excludedControls: 0,
      },
      debugLog: [],
    })
    questionItemRepository.find.mockResolvedValue([
      {
        questionId: 'question-required',
        controlId: 'control-a',
        questionCode: 'Q-ACC-001',
        questionText: '是否建立特权账号定期复核机制？',
        questionType: 'SINGLE_CHOICE',
        answerSchema: null,
        scoringRule: { mode: 'single_choice', passValues: ['yes'] },
        required: true,
      },
      {
        questionId: 'question-data',
        controlId: 'control-b',
        questionCode: 'Q-DATA-001',
        questionText: '是否建立跨境数据审批控制？',
        questionType: 'SINGLE_CHOICE',
        answerSchema: null,
        scoringRule: { mode: 'single_choice', passValues: ['implemented'] },
        required: true,
      },
    ])

    const result = await service.getForOrganization(VALID_ORG_ID)

    expect(result.missingQuestionControlIds).toEqual(['control-c'])
    expect(result.summary).toEqual({
      totalControls: 3,
      controlsWithQuestions: 2,
      missingQuestionControls: 1,
      totalQuestions: 2,
    })
  })

  it('should return a stable empty result when resolver returns no controls', async () => {
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      matchedPacks: [],
      matchedRules: [],
      controls: [],
      summary: {
        totalControls: 0,
        mandatoryCount: 0,
        matchedPacks: 0,
        matchedRules: 0,
        excludedControls: 0,
      },
      debugLog: [],
    })

    const result = await service.getForOrganization(VALID_ORG_ID)

    expect(questionItemRepository.find).not.toHaveBeenCalled()
    expect(result).toEqual({
      organizationId: VALID_ORG_ID,
      questions: [],
      missingQuestionControlIds: [],
      summary: {
        totalControls: 0,
        controlsWithQuestions: 0,
        missingQuestionControls: 0,
        totalQuestions: 0,
      },
    })
  })
})
