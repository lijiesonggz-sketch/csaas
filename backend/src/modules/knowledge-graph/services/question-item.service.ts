import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ILike, Repository } from 'typeorm'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { QuestionItem } from '../../../database/entities/question-item.entity'
import {
  CreateQuestionItemDto,
  QueryQuestionItemDto,
  UpdateQuestionItemDto,
} from '../dto/question-item.dto'

type QuestionItemView = {
  questionId: string
  controlId: string
  questionCode: string
  questionText: string
  questionType: string
  answerSchema: Record<string, unknown> | null
  scoringRule: Record<string, unknown> | null
  required: boolean
  status: string
}

@Injectable()
export class QuestionItemService {
  constructor(
    @InjectRepository(QuestionItem)
    private readonly questionItemRepository: Repository<QuestionItem>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
  ) {}

  async findAll(query: QueryQuestionItemDto) {
    const where: Record<string, unknown> = {}

    if (query.controlId) {
      where.controlId = query.controlId
    }

    if (query.questionType) {
      where.questionType = query.questionType
    }

    if (query.status) {
      where.status = query.status
    }

    if (query.required !== undefined) {
      where.required = query.required
    }

    if (query.keyword) {
      const keyword = ILike(`%${query.keyword}%`)
      const [items, total] = await this.questionItemRepository.findAndCount({
        where: [
          { ...where, questionCode: keyword },
          { ...where, questionText: keyword },
        ],
        order: { questionCode: 'ASC' },
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      })

      return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
    }

    const [items, total] = await this.questionItemRepository.findAndCount({
      where,
      order: { questionCode: 'ASC' },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
      take: query.limit ?? 20,
    })

    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
  }

  async create(dto: CreateQuestionItemDto): Promise<QuestionItem> {
    await this.assertControlPointExists(dto.controlId)
    await this.assertUniqueQuestionCode(dto.questionCode)

    return this.questionItemRepository.save(
      this.questionItemRepository.create({
        controlId: dto.controlId,
        questionCode: dto.questionCode,
        questionText: dto.questionText,
        questionType: dto.questionType,
        roleHint: dto.roleHint ?? null,
        answerSchema: dto.answerSchema ?? null,
        scoringRule: dto.scoringRule ?? null,
        applicableTags: dto.applicableTags ?? null,
        required: dto.required ?? true,
        status: dto.status ?? 'ACTIVE',
      }),
    )
  }

  async update(questionId: string, dto: UpdateQuestionItemDto): Promise<QuestionItem> {
    this.assertNoNullUpdates(dto, ['controlId', 'questionCode', 'questionText', 'questionType', 'required', 'status'])

    const existing = await this.findQuestionItem(questionId)
    const nextControlId = dto.controlId ?? existing.controlId
    const nextQuestionCode = dto.questionCode ?? existing.questionCode

    await this.assertControlPointExists(nextControlId)
    await this.assertUniqueQuestionCode(nextQuestionCode, questionId)

    Object.assign(existing, {
      controlId: nextControlId,
      questionCode: nextQuestionCode,
      questionText: dto.questionText ?? existing.questionText,
      questionType: dto.questionType ?? existing.questionType,
      roleHint: dto.roleHint ?? existing.roleHint,
      answerSchema: dto.answerSchema ?? existing.answerSchema,
      scoringRule: dto.scoringRule ?? existing.scoringRule,
      applicableTags: dto.applicableTags ?? existing.applicableTags,
      required: dto.required ?? existing.required,
      status: dto.status ?? existing.status,
    })

    return this.questionItemRepository.save(existing)
  }

  async findByControlId(controlId: string): Promise<{
    controlId: string
    questions: QuestionItemView[]
  }> {
    await this.findControlPoint(controlId)

    const items = await this.questionItemRepository
      .createQueryBuilder('question')
      .where('question.control_id = :controlId', { controlId })
      .andWhere('question.status = :status', { status: 'ACTIVE' })
      .getMany()

    const questions = items
      .slice()
      .sort((left, right) => {
        if (left.required !== right.required) {
          return left.required ? -1 : 1
        }

        return left.questionCode.localeCompare(right.questionCode)
      })
      .map((item) => ({
        questionId: item.questionId,
        controlId: item.controlId,
        questionCode: item.questionCode,
        questionText: item.questionText,
        questionType: item.questionType,
        answerSchema: item.answerSchema ?? null,
        scoringRule: item.scoringRule ?? null,
        required: item.required,
        status: item.status,
      }))

    return {
      controlId,
      questions,
    }
  }

  private async findQuestionItem(questionId: string): Promise<QuestionItem> {
    const questionItem = await this.questionItemRepository.findOne({ where: { questionId } })

    if (!questionItem) {
      throw new NotFoundException(`question_item ${questionId} not found`)
    }

    return questionItem
  }

  private async findControlPoint(controlId: string): Promise<ControlPoint> {
    const controlPoint = await this.controlPointRepository.findOne({ where: { controlId } })

    if (!controlPoint) {
      throw new NotFoundException(`control_point ${controlId} not found`)
    }

    return controlPoint
  }

  private async assertControlPointExists(controlId: string) {
    const controlPoint = await this.controlPointRepository.findOne({ where: { controlId } })

    if (!controlPoint) {
      throw new BadRequestException(`control_point ${controlId} does not exist`)
    }
  }

  private async assertUniqueQuestionCode(questionCode: string, currentQuestionId?: string) {
    const existing = await this.questionItemRepository.findOne({ where: { questionCode } })

    if (existing && existing.questionId !== currentQuestionId) {
      throw new ConflictException(`question_code ${questionCode} already exists`)
    }
  }

  private assertNoNullUpdates(dto: object, nonNullableFields: readonly string[]) {
    const record = dto as Record<string, unknown>

    for (const field of nonNullableFields) {
      if (record[field] === null) {
        throw new BadRequestException(`${field} cannot be null`)
      }
    }
  }
}
