import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AIGenerationResult, AITaskType, Project, SurveyResponse } from '../../database/entities'
import {
  ControlGapInputItemDto,
  ControlGapInputResponseDto,
  MissingAnswerDto,
} from './dto'

type RuntimeQuestion = {
  question_id: string
  cluster_id: string
  cluster_name?: string
  question_text?: string
  question_type?: string
  options?: Array<{
    option_id: string
    text?: string
    score?: number
  }>
}

@Injectable()
export class ControlGapInputService {
  constructor(
    @InjectRepository(SurveyResponse)
    private readonly surveyResponseRepository: Repository<SurveyResponse>,
    @InjectRepository(AIGenerationResult)
    private readonly aiGenerationResultRepository: Repository<AIGenerationResult>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async getControlGapInput(
    surveyResponseId: string,
    currentOrganizationId: string,
  ): Promise<ControlGapInputResponseDto> {
    const surveyResponse = await this.surveyResponseRepository.findOne({
      where: { id: surveyResponseId },
      relations: ['questionnaireTask'],
    })

    if (!surveyResponse) {
      throw new NotFoundException(`Survey response ${surveyResponseId} not found`)
    }

    if (!surveyResponse.questionnaireTaskId) {
      throw new BadRequestException(`Survey response ${surveyResponseId} has no questionnaire task`)
    }

    if (surveyResponse.questionnaireTask?.type !== AITaskType.QUESTIONNAIRE) {
      throw new BadRequestException('Survey response is not linked to a questionnaire snapshot task')
    }

    const project = await this.projectRepository.findOne({
      where: { id: surveyResponse.questionnaireTask.projectId },
    })

    if (!project) {
      throw new NotFoundException(
        `Project ${surveyResponse.questionnaireTask.projectId} not found for survey response ${surveyResponseId}`,
      )
    }

    if (!project.organizationId) {
      throw new BadRequestException(`Project ${project.id} is not linked to an organization`)
    }

    if (project.organizationId !== currentOrganizationId) {
      throw new ForbiddenException('Survey response does not belong to the current organization context')
    }

    const generationResult = await this.aiGenerationResultRepository.findOne({
      where: { taskId: surveyResponse.questionnaireTaskId },
    })
    const questionnaire = generationResult?.selectedResult?.questionnaire as RuntimeQuestion[] | undefined

    if (!Array.isArray(questionnaire)) {
      throw new NotFoundException(
        `Questionnaire snapshot payload not found for task ${surveyResponse.questionnaireTaskId}`,
      )
    }

    const answers = surveyResponse.answers ?? {}
    const grouped = new Map<
      string,
      {
        questionIds: string[]
        scores: number[]
        missingAnswers: MissingAnswerDto[]
        riskHints: string[]
      }
    >()

    questionnaire.forEach((question) => {
      const controlId = question.cluster_id
      if (!controlId) {
        return
      }

      const aggregate = grouped.get(controlId) ?? {
        questionIds: [],
        scores: [],
        missingAnswers: [],
        riskHints: [],
      }

      aggregate.questionIds.push(question.question_id)

      const answer = answers[question.question_id]
      const resolvedScore = this.resolveScore(answer, question)

      if (resolvedScore === null) {
        aggregate.missingAnswers.push({
          questionId: question.question_id,
          reason: answer ? 'invalid' : 'missing',
        })
      } else {
        aggregate.scores.push(resolvedScore)
      }

      grouped.set(controlId, aggregate)
    })

    const controls: ControlGapInputItemDto[] = Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([controlId, aggregate]) => {
        const averageScore =
          aggregate.scores.length > 0
            ? aggregate.scores.reduce((sum, score) => sum + score, 0) / aggregate.scores.length
            : 0

        const missingCount = aggregate.missingAnswers.length
        const lowScoreCount = aggregate.scores.filter((score) => score < 2).length

        if (missingCount > 0) {
          aggregate.riskHints.push(`Missing ${missingCount} answers for control ${controlId}`)
        }

        if (lowScoreCount > 0) {
          aggregate.riskHints.push(`Contains ${lowScoreCount} low-scoring answers`)
        }

        if (aggregate.scores.length > 0 && averageScore < 4) {
          aggregate.riskHints.push('Average score below compliance threshold')
        }

        const currentStatus: ControlGapInputItemDto['currentStatus'] =
          aggregate.scores.length === 0
            ? 'INCOMPLETE'
            : missingCount > 0
              ? 'PARTIAL'
              : averageScore >= 4
                ? 'COMPLIANT'
                : 'PARTIAL'

        const gapLevel: ControlGapInputItemDto['gapLevel'] =
          aggregate.scores.length === 0
            ? 'HIGH'
            : missingCount > 0
              ? averageScore >= 4
                ? 'MEDIUM'
                : 'HIGH'
              : averageScore >= 4
                ? 'LOW'
                : averageScore >= 2
                  ? 'MEDIUM'
                  : 'HIGH'

        return {
          controlId,
          questionIds: aggregate.questionIds,
          currentStatus,
          gapLevel,
          missingAnswers: aggregate.missingAnswers,
          riskHints: Array.from(new Set(aggregate.riskHints)),
        }
      })

    return {
      surveyResponseId,
      questionnaireTaskId: surveyResponse.questionnaireTaskId,
      projectId: project.id,
      controls,
    }
  }

  private resolveScore(answer: unknown, question: RuntimeQuestion): number | null {
    if (typeof answer === 'number' && Number.isFinite(answer)) {
      return answer
    }

    if (answer && typeof answer === 'object') {
      const record = answer as Record<string, unknown>

      if (typeof record.score === 'number' && Number.isFinite(record.score)) {
        return record.score
      }

      if (typeof record.answer === 'string') {
        const matchedOption = question.options?.find((option) => option.option_id === record.answer)
        if (matchedOption && typeof matchedOption.score === 'number') {
          return matchedOption.score
        }
      }
    }

    return null
  }
}
