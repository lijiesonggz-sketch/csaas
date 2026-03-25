import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { QuestionItem } from '../../../database/entities/question-item.entity'
import { QuestionItemService } from './question-item.service'

describe('QuestionItemService', () => {
  let service: QuestionItemService

  const questionItemRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const controlPointRepository = {
    findOne: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionItemService,
        {
          provide: getRepositoryToken(QuestionItem),
          useValue: questionItemRepository,
        },
        {
          provide: getRepositoryToken(ControlPoint),
          useValue: controlPointRepository,
        },
      ],
    }).compile()

    service = module.get(QuestionItemService)
    jest.clearAllMocks()
  })

  it('should reject creating question item when control point does not exist', async () => {
    controlPointRepository.findOne.mockResolvedValue(null)

    await expect(
      service.create({
        controlId: '550e8400-e29b-41d4-a716-446655440000',
        questionCode: 'Q-CTRL-001',
        questionText: '是否建立正式制度？',
        questionType: 'SINGLE_CHOICE',
        required: true,
      }),
    ).rejects.toThrow('control_point 550e8400-e29b-41d4-a716-446655440000 does not exist')
  })

  it('should reject duplicate question code before save', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
    })
    questionItemRepository.findOne.mockResolvedValue({
      questionId: 'existing-question',
      questionCode: 'Q-CTRL-001',
    })

    await expect(
      service.create({
        controlId: 'control-id',
        questionCode: 'Q-CTRL-001',
        questionText: '是否建立正式制度？',
        questionType: 'SINGLE_CHOICE',
        required: true,
      }),
    ).rejects.toThrow('question_code Q-CTRL-001 already exists')
  })

  it('should return structured questions with stable ordering and empty-safe semantics', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
    })

    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          questionId: 'question-required',
          controlId: 'control-id',
          questionCode: 'Q-CTRL-001',
          questionText: '是否建立正式制度？',
          questionType: 'SINGLE_CHOICE',
          answerSchema: { options: ['A', 'B', 'C'] },
          scoringRule: { mode: 'single_choice', maxScore: 5 },
          required: true,
          status: 'ACTIVE',
        },
        {
          questionId: 'question-optional',
          controlId: 'control-id',
          questionCode: 'Q-CTRL-002',
          questionText: '请描述补充情况',
          questionType: 'TEXT',
          answerSchema: { maxLength: 500 },
          scoringRule: null,
          required: false,
          status: 'ACTIVE',
        },
      ]),
    }
    questionItemRepository.createQueryBuilder.mockReturnValue(queryBuilder)

    const result = await service.findByControlId('control-id')

    expect(queryBuilder.where).toHaveBeenCalledWith('question.control_id = :controlId', {
      controlId: 'control-id',
    })
    expect(result).toEqual({
      controlId: 'control-id',
      questions: [
        {
          questionId: 'question-required',
          controlId: 'control-id',
          questionCode: 'Q-CTRL-001',
          questionText: '是否建立正式制度？',
          questionType: 'SINGLE_CHOICE',
          answerSchema: { options: ['A', 'B', 'C'] },
          scoringRule: { mode: 'single_choice', maxScore: 5 },
          required: true,
          status: 'ACTIVE',
        },
        {
          questionId: 'question-optional',
          controlId: 'control-id',
          questionCode: 'Q-CTRL-002',
          questionText: '请描述补充情况',
          questionType: 'TEXT',
          answerSchema: { maxLength: 500 },
          scoringRule: null,
          required: false,
          status: 'ACTIVE',
        },
      ],
    })
  })
})
