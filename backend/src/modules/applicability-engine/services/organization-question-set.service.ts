import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { QuestionItem } from '../../../database/entities/question-item.entity'
import { OrganizationQuestionSetResponseDto } from '../dto/organization-question-set.dto'
import { PackResolverService } from './pack-resolver.service'

@Injectable()
export class OrganizationQuestionSetService {
  constructor(
    private readonly packResolverService: PackResolverService,
    @InjectRepository(QuestionItem)
    private readonly questionItemRepository: Repository<QuestionItem>,
  ) {}

  async getForOrganization(
    organizationId: string,
  ): Promise<OrganizationQuestionSetResponseDto> {
    const resolved = await this.packResolverService.resolveByOrganizationId(organizationId)
    const controls = resolved.controls.slice()
    const controlIds = controls.map((control) => control.controlId)

    if (controlIds.length === 0) {
      return {
        organizationId,
        questions: [],
        missingQuestionControlIds: [],
        summary: {
          totalControls: 0,
          controlsWithQuestions: 0,
          missingQuestionControls: 0,
          totalQuestions: 0,
        },
      }
    }

    const items = await this.questionItemRepository.find({
      where: {
        controlId: In(controlIds),
        status: 'ACTIVE',
      },
    })

    const itemsByControlId = new Map<string, QuestionItem[]>()

    items.forEach((item) => {
      const existing = itemsByControlId.get(item.controlId) ?? []
      existing.push(item)
      itemsByControlId.set(item.controlId, existing)
    })

    const questions = controls.flatMap((control) =>
      (itemsByControlId.get(control.controlId) ?? [])
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
        })),
    )

    const missingQuestionControlIds = controls
      .filter((control) => (itemsByControlId.get(control.controlId) ?? []).length === 0)
      .map((control) => control.controlId)

    return {
      organizationId,
      questions,
      missingQuestionControlIds,
      summary: {
        totalControls: controls.length,
        controlsWithQuestions: controls.length - missingQuestionControlIds.length,
        missingQuestionControls: missingQuestionControlIds.length,
        totalQuestions: questions.length,
      },
    }
  }
}
