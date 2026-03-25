import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import {
  AIGenerationResult,
  AITask,
  AITaskType,
  ControlPoint,
  Project,
  ReviewStatus,
  TaskStatus,
} from '../../database/entities'
import { GenerationStage } from '../../database/entities/ai-task.entity'
import { OrganizationQuestionSetService } from '../applicability-engine/services/organization-question-set.service'
import {
  CreateProjectQuestionnaireSnapshotDto,
  ProjectQuestionnaireSnapshotResponseDto,
} from './dto'

type SnapshotQuestionInput = {
  questionId: string
  controlId: string
  questionCode: string
  questionText: string
  questionType: string
  answerSchema: Record<string, unknown> | null
  scoringRule: Record<string, unknown> | null
  required: boolean
}

type SnapshotQuestionOption = {
  option_id: string
  text: string
  score: number
  level?: string
  description?: string
}

type SnapshotQuestion = {
  question_id: string
  cluster_id: string
  cluster_name: string
  question_text: string
  question_type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING'
  options: SnapshotQuestionOption[]
  required: boolean
  guidance: string
}

type SnapshotMetadata = {
  projectId: string
  organizationId: string
  generatedAt: string
  snapshotVersion: number
  resolvedControlSetVersion: string
  questionSetVersion: string
  sourceControlIds: string[]
  missingQuestionControlIds: string[]
  snapshotKind: 'kg_dynamic_questionnaire'
  total_questions: number
  estimated_time_minutes: number
  coverage_map: Record<string, number>
}

const SNAPSHOT_KIND = 'kg_dynamic_questionnaire' as const

@Injectable()
export class ProjectQuestionnaireSnapshotService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
    @InjectRepository(AIGenerationResult)
    private readonly aiGenerationResultRepository: Repository<AIGenerationResult>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
    private readonly organizationQuestionSetService: OrganizationQuestionSetService,
  ) {}

  async createSnapshot(
    dto: CreateProjectQuestionnaireSnapshotDto,
    currentOrganizationId: string,
  ): Promise<ProjectQuestionnaireSnapshotResponseDto> {
    const project = await this.getAccessibleProject(dto.projectId, currentOrganizationId)
    const latestSnapshot = await this.findLatestSnapshotTask(project.id)

    if (latestSnapshot && !dto.regenerate) {
      return this.buildSnapshotResponse(latestSnapshot, true)
    }

    const questionSet = await this.organizationQuestionSetService.getForOrganization(
      project.organizationId,
    )

    if (questionSet.questions.length === 0) {
      throw new BadRequestException(
        `No applicable questions available for organization ${project.organizationId}`,
      )
    }

    const sourceControlIds = Array.from(
      new Set(questionSet.questions.map((question) => String(question.controlId))),
    )
    const controlPoints = await this.controlPointRepository.find({
      where: {
        controlId: In(sourceControlIds),
      },
    })
    const controlById = new Map(
      controlPoints.map((control) => [control.controlId, control] as const),
    )

    const snapshotVersion = this.getNextSnapshotVersion(latestSnapshot)
    const generatedAt = new Date().toISOString()
    const resolvedControlSetVersion = `resolved-controls@${generatedAt}`
    const questionSetVersion = `question-set@${generatedAt}`

    const questions = questionSet.questions.map((question, index) =>
      this.toRuntimeQuestion(
        question as SnapshotQuestionInput,
        controlById.get(String(question.controlId)),
        index,
      ),
    )

    const metadata: SnapshotMetadata = {
      projectId: project.id,
      organizationId: project.organizationId,
      generatedAt,
      snapshotVersion,
      resolvedControlSetVersion,
      questionSetVersion,
      sourceControlIds,
      missingQuestionControlIds: questionSet.missingQuestionControlIds,
      snapshotKind: SNAPSHOT_KIND,
      total_questions: questions.length,
      estimated_time_minutes: Math.max(1, Math.ceil(questions.length * 0.5)),
      coverage_map: questions.reduce<Record<string, number>>((acc, question) => {
        acc[question.cluster_id] = (acc[question.cluster_id] ?? 0) + 1
        return acc
      }, {}),
    }

    const selectedResult = {
      questionnaire: questions,
      questionnaire_metadata: metadata,
    }

    const task = await this.aiTaskRepository.save(
      this.aiTaskRepository.create({
        projectId: project.id,
        type: AITaskType.QUESTIONNAIRE,
        status: TaskStatus.COMPLETED,
        generationStage: GenerationStage.COMPLETED,
        input: {
          snapshotKind: SNAPSHOT_KIND,
          organizationId: project.organizationId,
          generatedAt,
          snapshotVersion,
          resolvedControlSetVersion,
          questionSetVersion,
          sourceControlIds,
          missingQuestionControlIds: questionSet.missingQuestionControlIds,
          regenerateRequested: dto.regenerate ?? false,
        },
        result: {
          snapshotKind: SNAPSHOT_KIND,
          snapshotVersion,
          generatedAt,
        },
        priority: 1,
        progress: 100,
        completedAt: new Date(generatedAt),
      }),
    )

    await this.aiGenerationResultRepository.save(
      this.aiGenerationResultRepository.create({
        taskId: task.id,
        generationType: AITaskType.QUESTIONNAIRE,
        selectedResult,
        reviewStatus: ReviewStatus.PENDING,
        version: snapshotVersion,
      }),
    )

    return {
      projectId: project.id,
      organizationId: project.organizationId,
      questionnaireTaskId: task.id,
      generatedAt,
      snapshotVersion,
      resolvedControlSetVersion,
      questionSetVersion,
      sourceControlIds,
      missingQuestionControlIds: questionSet.missingQuestionControlIds,
      reusedExisting: false,
      questions,
    }
  }

  async getSnapshot(
    projectId: string,
    currentOrganizationId: string,
  ): Promise<ProjectQuestionnaireSnapshotResponseDto> {
    await this.getAccessibleProject(projectId, currentOrganizationId)
    const latestSnapshot = await this.findLatestSnapshotTask(projectId)

    if (!latestSnapshot) {
      throw new NotFoundException(`Questionnaire snapshot not found for project ${projectId}`)
    }

    return this.buildSnapshotResponse(latestSnapshot, true)
  }

  private async getAccessibleProject(
    projectId: string,
    currentOrganizationId: string,
  ): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    })

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`)
    }

    if (!project.organizationId) {
      throw new BadRequestException(`Project ${projectId} is not linked to an organization`)
    }

    if (project.organizationId !== currentOrganizationId) {
      throw new ForbiddenException('Project does not belong to the current organization context')
    }

    return project
  }

  private async findLatestSnapshotTask(projectId: string): Promise<AITask | null> {
    const tasks = await this.aiTaskRepository.find({
      where: {
        projectId,
        type: AITaskType.QUESTIONNAIRE,
        status: TaskStatus.COMPLETED,
      },
      order: {
        createdAt: 'DESC',
      },
    })

    return (
      tasks.find((task) => task.input?.snapshotKind === SNAPSHOT_KIND) ?? null
    )
  }

  private async buildSnapshotResponse(
    task: AITask,
    reusedExisting: boolean,
  ): Promise<ProjectQuestionnaireSnapshotResponseDto> {
    const generationResult = await this.aiGenerationResultRepository.findOne({
      where: { taskId: task.id },
    })

    const metadata = generationResult?.selectedResult?.questionnaire_metadata as SnapshotMetadata | undefined
    const questions = (generationResult?.selectedResult?.questionnaire ?? []) as Array<Record<string, unknown>>

    if (!generationResult?.selectedResult || !metadata) {
      throw new NotFoundException(`Questionnaire snapshot payload not found for task ${task.id}`)
    }

    return {
      projectId: metadata.projectId,
      organizationId: metadata.organizationId,
      questionnaireTaskId: task.id,
      generatedAt: metadata.generatedAt,
      snapshotVersion: metadata.snapshotVersion,
      resolvedControlSetVersion: metadata.resolvedControlSetVersion,
      questionSetVersion: metadata.questionSetVersion,
      sourceControlIds: metadata.sourceControlIds,
      missingQuestionControlIds: metadata.missingQuestionControlIds,
      reusedExisting,
      questions,
    }
  }

  private getNextSnapshotVersion(latestSnapshot: AITask | null): number {
    const currentVersion = Number(latestSnapshot?.input?.snapshotVersion ?? 0)
    return currentVersion + 1
  }

  private toRuntimeQuestion(
    question: SnapshotQuestionInput,
    controlPoint: ControlPoint | undefined,
    index: number,
  ): SnapshotQuestion {
    const questionType = this.mapQuestionType(question.questionType)
    const options = this.buildOptions(question, questionType)

    return {
      question_id: question.questionCode || question.questionId,
      cluster_id: question.controlId,
      cluster_name: controlPoint?.controlName ?? controlPoint?.controlCode ?? question.controlId,
      question_text: question.questionText,
      question_type: questionType,
      options,
      required: question.required,
      guidance: question.required
        ? '此题为必答题，请选择最符合当前控制现状的选项。'
        : '请根据项目当前实际情况填写。',
    }
  }

  private mapQuestionType(
    questionType: string,
  ): 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING' {
    switch ((questionType ?? '').toUpperCase()) {
      case 'YES_NO':
      case 'SINGLE_CHOICE':
        return 'SINGLE_CHOICE'
      case 'MULTIPLE_CHOICE':
        return 'MULTIPLE_CHOICE'
      case 'RATING':
        return 'RATING'
      default:
        throw new BadRequestException(`Question type ${questionType} is not supported by survey runtime`)
    }
  }

  private buildOptions(
    question: SnapshotQuestionInput,
    runtimeType: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING',
  ): SnapshotQuestionOption[] {
    if (runtimeType === 'RATING') {
      return this.buildRatingOptions(question.answerSchema)
    }

    const schemaOptions = this.extractSchemaOptions(question.answerSchema)

    if (schemaOptions.length > 0) {
      return schemaOptions
    }

    if (runtimeType === 'SINGLE_CHOICE') {
      const firstPassValue = Array.isArray(question.scoringRule?.passValues)
        ? String(question.scoringRule?.passValues[0] ?? 'yes')
        : 'yes'

      return [
        {
          option_id: 'A',
          text: firstPassValue,
          score: 5,
          level: 'level_5',
        },
        {
          option_id: 'B',
          text: `not_${firstPassValue}`,
          score: 0,
          level: 'level_1',
        },
      ]
    }

    throw new BadRequestException(
      `Question ${question.questionCode || question.questionId} is missing selectable options for type ${runtimeType}`,
    )
  }

  private buildRatingOptions(answerSchema: Record<string, unknown> | null): SnapshotQuestionOption[] {
    const schemaOptions = this.extractSchemaOptions(answerSchema)

    if (schemaOptions.length > 0) {
      return schemaOptions
    }

    return [1, 2, 3, 4, 5].map((score) => ({
      option_id: String(score),
      text: `${score}分`,
      score,
      level: `level_${score}`,
    }))
  }

  private extractSchemaOptions(answerSchema: Record<string, unknown> | null): SnapshotQuestionOption[] {
    const options = answerSchema?.options

    if (!Array.isArray(options)) {
      return []
    }

    return options.map((option, index) => {
      if (typeof option === 'string') {
        return {
          option_id: String.fromCharCode(65 + index),
          text: option,
          score: index + 1,
        }
      }

      if (option && typeof option === 'object') {
        const record = option as Record<string, unknown>

        return {
          option_id:
            typeof record.option_id === 'string'
              ? record.option_id
              : typeof record.id === 'string'
                ? record.id
                : String.fromCharCode(65 + index),
          text:
            typeof record.text === 'string'
              ? record.text
              : typeof record.label === 'string'
                ? record.label
                : String(record.value ?? `Option ${index + 1}`),
          score: typeof record.score === 'number' ? record.score : index + 1,
          level: typeof record.level === 'string' ? record.level : undefined,
          description:
            typeof record.description === 'string' ? record.description : undefined,
        }
      }

      throw new BadRequestException('Question answerSchema contains an unsupported option payload')
    })
  }
}
