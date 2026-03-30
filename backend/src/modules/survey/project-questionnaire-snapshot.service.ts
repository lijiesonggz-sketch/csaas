import { randomUUID } from 'crypto'
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
  ProjectMemberRole,
  ReviewStatus,
  SurveyResponse,
  TaskStatus,
} from '../../database/entities'
import { GenerationStage } from '../../database/entities/ai-task.entity'
import { OrganizationQuestionSetService } from '../applicability-engine/services/organization-question-set.service'
import { ProjectMembersService } from '../projects/services/project-members.service'
import {
  ProjectQuestionnaireChangeType,
  ProjectQuestionnaireFreshnessResponseDto,
  CreateProjectQuestionnaireSnapshotDto,
  ProjectQuestionnaireSnapshotLifecycleStatus,
  ProjectQuestionnairePublishImpactResponseDto,
  ProjectQuestionnaireSnapshotResponseDto,
  SaveProjectQuestionnaireSnapshotDraftDto,
  SaveProjectQuestionnaireSnapshotDraftOptionDto,
  SaveProjectQuestionnaireSnapshotDraftQuestionDto,
  ProjectQuestionnaireStaleTarget,
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
  question_template_id: string | null
  source_question_id: string | null
  control_id: string
  cluster_id: string
  cluster_name: string
  question_text: string
  question_type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING'
  options: SnapshotQuestionOption[]
  required: boolean
  guidance: string
  display_order: number
  scoring_rule: Record<string, unknown> | null
  is_project_custom: boolean
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
  lifecycleStatus?: ProjectQuestionnaireSnapshotLifecycleStatus
  publishedSnapshotTaskId?: string | null
  baseSnapshotTaskId?: string | null
  editVersion?: number
  lastEditedAt?: string | null
  lastEditedBy?: string | null
  lastPublishedImpact?: {
    requiresDownstreamRefresh: boolean
    staleTargets: ProjectQuestionnaireStaleTarget[]
    changeTypes: ProjectQuestionnaireChangeType[]
    message: string
  } | null
}

type SnapshotRecord = {
  task: AITask
  generationResult: AIGenerationResult
  metadata: SnapshotMetadata
  questions: SnapshotQuestion[]
}

const SNAPSHOT_KIND = 'kg_dynamic_questionnaire' as const
const SUPPORTED_RUNTIME_QUESTION_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'RATING'] as const

@Injectable()
export class ProjectQuestionnaireSnapshotService {
  constructor(
    @InjectRepository(SurveyResponse)
    private readonly surveyResponseRepository: Repository<SurveyResponse>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
    @InjectRepository(AIGenerationResult)
    private readonly aiGenerationResultRepository: Repository<AIGenerationResult>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
    private readonly organizationQuestionSetService: OrganizationQuestionSetService,
    private readonly projectMembersService: ProjectMembersService,
  ) {}

  async createSnapshot(
    dto: CreateProjectQuestionnaireSnapshotDto,
    currentOrganizationId: string,
  ): Promise<ProjectQuestionnaireSnapshotResponseDto> {
    const project = await this.getAccessibleProject(dto.projectId, currentOrganizationId)
    const snapshotRecords = await this.loadSnapshotRecords(project.id)
    const currentWorkingSnapshot = this.selectCurrentWorkingSnapshot(snapshotRecords)

    if (currentWorkingSnapshot && !dto.regenerate) {
      return this.buildSnapshotResponse(currentWorkingSnapshot, true)
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

    const snapshotVersion = this.getNextSnapshotVersion(this.selectLatestSnapshotRecord(snapshotRecords))
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
      estimated_time_minutes: this.estimateTimeMinutes(questions.length),
      coverage_map: this.buildCoverageMap(questions),
      lifecycleStatus: 'published',
      publishedSnapshotTaskId: null,
      baseSnapshotTaskId: null,
      editVersion: 0,
      lastEditedAt: generatedAt,
      lastEditedBy: null,
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
          lifecycleStatus: 'published',
          baseSnapshotTaskId: null,
          publishedSnapshotTaskId: null,
          editVersion: 0,
        },
        result: {
          snapshotKind: SNAPSHOT_KIND,
          snapshotVersion,
          generatedAt,
          lifecycleStatus: 'published',
        },
        priority: 1,
        progress: 100,
        completedAt: new Date(generatedAt),
      }),
    )

    metadata.publishedSnapshotTaskId = task.id
    task.input = {
      ...task.input,
      publishedSnapshotTaskId: task.id,
    }
    task.result = {
      ...task.result,
      publishedSnapshotTaskId: task.id,
    }
    await this.aiTaskRepository.save(task)

    const generationResult = await this.aiGenerationResultRepository.save(
      this.aiGenerationResultRepository.create({
        taskId: task.id,
        generationType: AITaskType.QUESTIONNAIRE,
        selectedResult: {
          questionnaire: questions,
          questionnaire_metadata: metadata,
        },
        reviewStatus: ReviewStatus.PENDING,
        version: snapshotVersion,
      }),
    )

    return this.buildSnapshotResponse(
      {
        task,
        generationResult,
        metadata,
        questions,
      },
      false,
    )
  }

  async getSnapshot(
    projectId: string,
    currentOrganizationId: string,
  ): Promise<ProjectQuestionnaireSnapshotResponseDto> {
    await this.getAccessibleProject(projectId, currentOrganizationId)
    const snapshotRecords = await this.loadSnapshotRecords(projectId)
    const currentWorkingSnapshot = this.selectCurrentWorkingSnapshot(snapshotRecords)

    if (!currentWorkingSnapshot) {
      throw new NotFoundException(`Questionnaire snapshot not found for project ${projectId}`)
    }

    return this.buildSnapshotResponse(currentWorkingSnapshot, true)
  }

  async saveDraft(
    projectId: string,
    dto: SaveProjectQuestionnaireSnapshotDraftDto,
    currentOrganizationId: string,
    currentUserId: string,
  ): Promise<ProjectQuestionnaireSnapshotResponseDto> {
    const project = await this.getAccessibleProject(projectId, currentOrganizationId)
    await this.assertProjectMaintenancePermission(project.id, currentUserId)

    const snapshotRecords = await this.loadSnapshotRecords(project.id)
    const latestPublishedSnapshot =
      this.selectLatestSnapshotByLifecycle(snapshotRecords, 'published') ??
      this.selectLatestSnapshotRecord(snapshotRecords)

    if (!latestPublishedSnapshot) {
      throw new NotFoundException(`Questionnaire snapshot not found for project ${project.id}`)
    }

    const existingDraftSnapshot = this.selectLatestSnapshotByLifecycle(snapshotRecords, 'draft')
    const baselineSnapshot = existingDraftSnapshot ?? latestPublishedSnapshot
    const normalizedQuestions = await this.normalizeDraftQuestions(dto.questions, baselineSnapshot.questions)
    const now = new Date().toISOString()

    if (existingDraftSnapshot) {
      const updatedMetadata = this.buildUpdatedDraftMetadata(
        existingDraftSnapshot.metadata,
        normalizedQuestions,
        latestPublishedSnapshot.task.id,
        currentUserId,
        now,
      )

      existingDraftSnapshot.task.input = {
        ...existingDraftSnapshot.task.input,
        lifecycleStatus: 'draft',
        publishedSnapshotTaskId: latestPublishedSnapshot.task.id,
        baseSnapshotTaskId:
          existingDraftSnapshot.metadata.baseSnapshotTaskId ?? latestPublishedSnapshot.task.id,
        editVersion: updatedMetadata.editVersion,
        lastEditedAt: updatedMetadata.lastEditedAt,
        lastEditedBy: updatedMetadata.lastEditedBy,
      }
      existingDraftSnapshot.task.result = {
        ...existingDraftSnapshot.task.result,
        lifecycleStatus: 'draft',
        publishedSnapshotTaskId: latestPublishedSnapshot.task.id,
        baseSnapshotTaskId:
          existingDraftSnapshot.metadata.baseSnapshotTaskId ?? latestPublishedSnapshot.task.id,
        editVersion: updatedMetadata.editVersion,
      }
      existingDraftSnapshot.generationResult.selectedResult = {
        questionnaire: normalizedQuestions,
        questionnaire_metadata: updatedMetadata,
      }

      const [task, generationResult] = await Promise.all([
        this.aiTaskRepository.save(existingDraftSnapshot.task),
        this.aiGenerationResultRepository.save(existingDraftSnapshot.generationResult),
      ])

      return this.buildSnapshotResponse(
        {
          task,
          generationResult,
          metadata: updatedMetadata,
          questions: normalizedQuestions,
        },
        false,
      )
    }

    const snapshotVersion = this.getNextSnapshotVersion(this.selectLatestSnapshotRecord(snapshotRecords))
    const metadata = this.buildNewDraftMetadata(
      latestPublishedSnapshot.metadata,
      normalizedQuestions,
      snapshotVersion,
      latestPublishedSnapshot.task.id,
      currentUserId,
      now,
    )

    const task = await this.aiTaskRepository.save(
      this.aiTaskRepository.create({
        projectId: project.id,
        type: AITaskType.QUESTIONNAIRE,
        status: TaskStatus.COMPLETED,
        generationStage: GenerationStage.COMPLETED,
        input: {
          snapshotKind: SNAPSHOT_KIND,
          organizationId: project.organizationId,
          generatedAt: metadata.generatedAt,
          snapshotVersion,
          resolvedControlSetVersion: metadata.resolvedControlSetVersion,
          questionSetVersion: metadata.questionSetVersion,
          sourceControlIds: metadata.sourceControlIds,
          missingQuestionControlIds: metadata.missingQuestionControlIds,
          lifecycleStatus: 'draft',
          baseSnapshotTaskId: latestPublishedSnapshot.task.id,
          publishedSnapshotTaskId: latestPublishedSnapshot.task.id,
          editVersion: metadata.editVersion,
          lastEditedAt: metadata.lastEditedAt,
          lastEditedBy: metadata.lastEditedBy,
        },
        result: {
          snapshotKind: SNAPSHOT_KIND,
          snapshotVersion,
          generatedAt: metadata.generatedAt,
          lifecycleStatus: 'draft',
          baseSnapshotTaskId: latestPublishedSnapshot.task.id,
          publishedSnapshotTaskId: latestPublishedSnapshot.task.id,
          editVersion: metadata.editVersion,
        },
        priority: 1,
        progress: 100,
        completedAt: new Date(now),
      }),
    )

    const generationResult = await this.aiGenerationResultRepository.save(
      this.aiGenerationResultRepository.create({
        taskId: task.id,
        generationType: AITaskType.QUESTIONNAIRE,
        selectedResult: {
          questionnaire: normalizedQuestions,
          questionnaire_metadata: metadata,
        },
        reviewStatus: ReviewStatus.MODIFIED,
        version: snapshotVersion,
      }),
    )

    return this.buildSnapshotResponse(
      {
        task,
        generationResult,
        metadata,
        questions: normalizedQuestions,
      },
      false,
    )
  }

  async publishDraft(
    projectId: string,
    currentOrganizationId: string,
    currentUserId: string,
  ): Promise<ProjectQuestionnaireSnapshotResponseDto> {
    const project = await this.getAccessibleProject(projectId, currentOrganizationId)
    await this.assertProjectMaintenancePermission(project.id, currentUserId)

    const snapshotRecords = await this.loadSnapshotRecords(project.id)
    const latestDraftSnapshot = this.selectLatestSnapshotByLifecycle(snapshotRecords, 'draft')

    if (!latestDraftSnapshot) {
      throw new NotFoundException(`Questionnaire draft not found for project ${project.id}`)
    }

    const latestPublishedSnapshot = this.selectLatestSnapshotByLifecycle(snapshotRecords, 'published')
    const now = new Date().toISOString()
    const publishImpact = this.buildPublishImpact(
      latestPublishedSnapshot?.questions ?? [],
      latestDraftSnapshot.questions,
      latestPublishedSnapshot?.task.id ?? null,
      latestDraftSnapshot.task.id,
      project.id,
    )

    const publishedMetadata: SnapshotMetadata = {
      ...latestDraftSnapshot.metadata,
      lifecycleStatus: 'published',
      publishedSnapshotTaskId: latestDraftSnapshot.task.id,
      baseSnapshotTaskId: latestDraftSnapshot.metadata.baseSnapshotTaskId ?? latestPublishedSnapshot?.task.id ?? null,
      lastEditedAt: now,
      lastEditedBy: currentUserId,
      lastPublishedImpact: publishImpact,
    }

    latestDraftSnapshot.task.input = {
      ...latestDraftSnapshot.task.input,
      lifecycleStatus: 'published',
      publishedSnapshotTaskId: latestDraftSnapshot.task.id,
      baseSnapshotTaskId: publishedMetadata.baseSnapshotTaskId,
      lastEditedAt: now,
      lastEditedBy: currentUserId,
    }
    latestDraftSnapshot.task.result = {
      ...latestDraftSnapshot.task.result,
      lifecycleStatus: 'published',
      publishedSnapshotTaskId: latestDraftSnapshot.task.id,
      baseSnapshotTaskId: publishedMetadata.baseSnapshotTaskId,
    }
    latestDraftSnapshot.generationResult.selectedResult = {
      questionnaire: latestDraftSnapshot.questions,
      questionnaire_metadata: publishedMetadata,
    }

    const saves: Array<Promise<unknown>> = [
      this.aiTaskRepository.save(latestDraftSnapshot.task),
      this.aiGenerationResultRepository.save(latestDraftSnapshot.generationResult),
    ]

    if (latestPublishedSnapshot && latestPublishedSnapshot.task.id !== latestDraftSnapshot.task.id) {
      const supersededMetadata: SnapshotMetadata = {
        ...latestPublishedSnapshot.metadata,
        lifecycleStatus: 'superseded',
        publishedSnapshotTaskId: latestDraftSnapshot.task.id,
        lastEditedAt: now,
        lastEditedBy: currentUserId,
      }

      latestPublishedSnapshot.task.input = {
        ...latestPublishedSnapshot.task.input,
        lifecycleStatus: 'superseded',
        publishedSnapshotTaskId: latestDraftSnapshot.task.id,
        lastEditedAt: now,
        lastEditedBy: currentUserId,
      }
      latestPublishedSnapshot.task.result = {
        ...latestPublishedSnapshot.task.result,
        lifecycleStatus: 'superseded',
        publishedSnapshotTaskId: latestDraftSnapshot.task.id,
      }
      latestPublishedSnapshot.generationResult.selectedResult = {
        questionnaire: latestPublishedSnapshot.questions,
        questionnaire_metadata: supersededMetadata,
      }

      saves.push(
        this.aiTaskRepository.save(latestPublishedSnapshot.task),
        this.aiGenerationResultRepository.save(latestPublishedSnapshot.generationResult),
      )
    }

    await Promise.all(saves)

    return this.buildSnapshotResponse(
      {
        task: latestDraftSnapshot.task,
        generationResult: latestDraftSnapshot.generationResult,
        metadata: publishedMetadata,
        questions: latestDraftSnapshot.questions,
      },
      false,
    )
  }

  async previewPublishImpact(
    projectId: string,
    currentOrganizationId: string,
    currentUserId: string,
  ): Promise<ProjectQuestionnairePublishImpactResponseDto> {
    const project = await this.getAccessibleProject(projectId, currentOrganizationId)
    await this.assertProjectMaintenancePermission(project.id, currentUserId)

    const snapshotRecords = await this.loadSnapshotRecords(project.id)
    const latestDraftSnapshot = this.selectLatestSnapshotByLifecycle(snapshotRecords, 'draft')

    if (!latestDraftSnapshot) {
      throw new NotFoundException(`Questionnaire draft not found for project ${project.id}`)
    }

    const latestPublishedSnapshot = this.selectLatestSnapshotByLifecycle(snapshotRecords, 'published')
    const impact = this.buildPublishImpact(
      latestPublishedSnapshot?.questions ?? [],
      latestDraftSnapshot.questions,
      latestPublishedSnapshot?.task.id ?? null,
      latestDraftSnapshot.task.id,
      project.id,
    )

    return {
      projectId: project.id,
      questionnaireTaskId: latestDraftSnapshot.task.id,
      publishedSnapshotTaskId: latestPublishedSnapshot?.task.id ?? null,
      requiresDownstreamRefresh: impact.requiresDownstreamRefresh,
      staleTargets: impact.staleTargets,
      changeTypes: impact.changeTypes,
      message: impact.message,
    }
  }

  async evaluateDownstreamFreshnessForSurveyResponse(
    surveyResponseId: string,
    currentOrganizationId: string,
  ): Promise<ProjectQuestionnaireFreshnessResponseDto> {
    const surveyResponse = await this.surveyResponseRepository.findOne({
      where: { id: surveyResponseId },
      relations: ['questionnaireTask'],
    })

    if (!surveyResponse?.questionnaireTask?.projectId) {
      throw new NotFoundException(`Survey response ${surveyResponseId} not found`)
    }

    const project = await this.getAccessibleProject(
      surveyResponse.questionnaireTask.projectId,
      currentOrganizationId,
    )

    return {
      surveyResponseId,
      ...await this.evaluateDownstreamFreshness(project.id, surveyResponse.questionnaireTaskId),
    }
  }

  async evaluateDownstreamFreshness(
    projectId: string,
    questionnaireTaskId: string,
  ): Promise<Omit<ProjectQuestionnaireFreshnessResponseDto, 'surveyResponseId'>> {
    const snapshotRecords = await this.loadSnapshotRecords(projectId)
    const latestPublishedSnapshot = this.selectLatestSnapshotByLifecycle(snapshotRecords, 'published')

    if (!latestPublishedSnapshot) {
      return {
        projectId,
        questionnaireTaskId,
        latestPublishedSnapshotTaskId: null,
        isStale: false,
        staleTargets: [],
        changeTypes: [],
        message: null,
      }
    }

    if (latestPublishedSnapshot.task.id === questionnaireTaskId) {
      return {
        projectId,
        questionnaireTaskId,
        latestPublishedSnapshotTaskId: latestPublishedSnapshot.task.id,
        isStale: false,
        staleTargets: [],
        changeTypes: [],
        message: null,
      }
    }

    const impact = latestPublishedSnapshot.metadata.lastPublishedImpact

    if (!impact?.requiresDownstreamRefresh) {
      return {
        projectId,
        questionnaireTaskId,
        latestPublishedSnapshotTaskId: latestPublishedSnapshot.task.id,
        isStale: false,
        staleTargets: [],
        changeTypes: impact?.changeTypes ?? [],
        message: null,
      }
    }

    return {
      projectId,
      questionnaireTaskId,
      latestPublishedSnapshotTaskId: latestPublishedSnapshot.task.id,
      isStale: true,
      staleTargets: impact.staleTargets,
      changeTypes: impact.changeTypes,
      message: impact.message,
    }
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

  private async assertProjectMaintenancePermission(
    projectId: string,
    currentUserId: string,
  ): Promise<void> {
    if (!currentUserId) {
      throw new ForbiddenException('Current user is required to edit questionnaire snapshots')
    }

    const allowed = await this.projectMembersService.checkPermission(projectId, currentUserId, [
      ProjectMemberRole.OWNER,
      ProjectMemberRole.EDITOR,
    ])

    if (!allowed) {
      throw new ForbiddenException('Only project owners and editors can modify questionnaire snapshots')
    }
  }

  private async loadSnapshotRecords(projectId: string): Promise<SnapshotRecord[]> {
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

    const records = await Promise.all(
      tasks.map(async (task) => {
        if (task.input?.snapshotKind !== SNAPSHOT_KIND) {
          return null
        }

        const generationResult = await this.aiGenerationResultRepository.findOne({
          where: { taskId: task.id },
        })

        if (!generationResult?.selectedResult) {
          return null
        }

        const questionnaireMetadata = generationResult.selectedResult
          ?.questionnaire_metadata as SnapshotMetadata | undefined
        const questionnaire = generationResult.selectedResult
          ?.questionnaire as Array<Record<string, unknown>> | undefined

        if (!Array.isArray(questionnaire) || !questionnaireMetadata) {
          return null
        }

        return {
          task,
          generationResult,
          metadata: this.normalizeStoredMetadata(questionnaireMetadata, task),
          questions: questionnaire.map((question, index) =>
            this.normalizeStoredQuestion(question, index),
          ),
        } satisfies SnapshotRecord
      }),
    )

    return records
      .filter((record): record is SnapshotRecord => record !== null)
      .sort((left, right) => this.compareSnapshotRecords(left, right))
  }

  private normalizeStoredMetadata(metadata: SnapshotMetadata, task: AITask): SnapshotMetadata {
    const lifecycleStatus = this.normalizeLifecycleStatus(metadata.lifecycleStatus)
    const generatedAt = metadata.generatedAt ?? task.createdAt?.toISOString() ?? new Date().toISOString()

    return {
      ...metadata,
      generatedAt,
      snapshotKind: SNAPSHOT_KIND,
      lifecycleStatus,
      publishedSnapshotTaskId:
        metadata.publishedSnapshotTaskId ??
        (lifecycleStatus === 'published' ? task.id : null),
      baseSnapshotTaskId: metadata.baseSnapshotTaskId ?? null,
      editVersion: Number(metadata.editVersion ?? 0),
      lastEditedAt: metadata.lastEditedAt ?? generatedAt,
      lastEditedBy: metadata.lastEditedBy ?? null,
      lastPublishedImpact: metadata.lastPublishedImpact ?? null,
      total_questions: Number(metadata.total_questions ?? 0),
      estimated_time_minutes: Number(metadata.estimated_time_minutes ?? 0),
      coverage_map:
        metadata.coverage_map && typeof metadata.coverage_map === 'object'
          ? metadata.coverage_map
          : {},
    }
  }

  private normalizeStoredQuestion(
    rawQuestion: Record<string, unknown>,
    index: number,
  ): SnapshotQuestion {
    const controlId =
      this.normalizeString(rawQuestion.control_id) ??
      this.normalizeString(rawQuestion.cluster_id)

    if (!controlId) {
      throw new BadRequestException('Snapshot question is missing control binding')
    }

    const questionType = this.normalizeStoredQuestionType(rawQuestion.question_type)

    return {
      question_id:
        this.normalizeString(rawQuestion.question_id) ?? `snapshot-question-${index + 1}`,
      question_template_id:
        this.normalizeNullableString(rawQuestion.question_template_id) ??
        this.normalizeNullableString(rawQuestion.source_question_id) ??
        this.normalizeString(rawQuestion.question_id) ??
        null,
      source_question_id:
        this.normalizeNullableString(rawQuestion.source_question_id) ??
        this.normalizeNullableString(rawQuestion.question_template_id) ??
        this.normalizeString(rawQuestion.question_id) ??
        null,
      control_id: controlId,
      cluster_id: controlId,
      cluster_name:
        this.normalizeString(rawQuestion.cluster_name) ?? controlId,
      question_text:
        this.normalizeString(rawQuestion.question_text) ?? '',
      question_type: questionType,
      options: this.normalizeStoredOptions(rawQuestion.options),
      required: Boolean(rawQuestion.required),
      guidance:
        this.normalizeString(rawQuestion.guidance) ??
        this.buildGuidance(Boolean(rawQuestion.required)),
      display_order: Number(rawQuestion.display_order ?? index + 1),
      scoring_rule: this.normalizeScoringRule(rawQuestion.scoring_rule ?? null),
      is_project_custom: Boolean(rawQuestion.is_project_custom ?? false),
    }
  }

  private normalizeStoredOptions(value: unknown): SnapshotQuestionOption[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map((option, index) => {
        if (!option || typeof option !== 'object') {
          return null
        }

        const record = option as Record<string, unknown>
        const text = this.normalizeString(record.text)

        if (!text) {
          return null
        }

        return {
          option_id:
            this.normalizeString(record.option_id) ??
            this.normalizeString(record.id) ??
            this.buildOptionId(index),
          text,
          score: Number(record.score ?? index + 1),
          level: this.normalizeNullableString(record.level),
          description: this.normalizeNullableString(record.description),
        } satisfies SnapshotQuestionOption
      })
      .filter(Boolean) as SnapshotQuestionOption[]
  }

  private normalizeStoredQuestionType(value: unknown): SnapshotQuestion['question_type'] {
    const normalized = this.normalizeString(value)?.toUpperCase()

    if (
      normalized &&
      (SUPPORTED_RUNTIME_QUESTION_TYPES as readonly string[]).includes(normalized)
    ) {
      return normalized as SnapshotQuestion['question_type']
    }

    throw new BadRequestException(`Question type ${String(value)} is not supported by survey runtime`)
  }

  private selectCurrentWorkingSnapshot(records: SnapshotRecord[]): SnapshotRecord | null {
    return (
      this.selectLatestSnapshotByLifecycle(records, 'draft') ??
      this.selectLatestSnapshotByLifecycle(records, 'published') ??
      this.selectLatestSnapshotRecord(records)
    )
  }

  private selectLatestSnapshotByLifecycle(
    records: SnapshotRecord[],
    lifecycleStatus: ProjectQuestionnaireSnapshotLifecycleStatus,
  ): SnapshotRecord | null {
    return (
      records.find(
        (record) => this.normalizeLifecycleStatus(record.metadata.lifecycleStatus) === lifecycleStatus,
      ) ?? null
    )
  }

  private selectLatestSnapshotRecord(records: SnapshotRecord[]): SnapshotRecord | null {
    return records[0] ?? null
  }

  private compareSnapshotRecords(left: SnapshotRecord, right: SnapshotRecord): number {
    const versionDelta =
      Number(right.metadata.snapshotVersion ?? 0) - Number(left.metadata.snapshotVersion ?? 0)

    if (versionDelta !== 0) {
      return versionDelta
    }

    return new Date(right.task.createdAt ?? 0).getTime() - new Date(left.task.createdAt ?? 0).getTime()
  }

  private normalizeLifecycleStatus(
    value: ProjectQuestionnaireSnapshotLifecycleStatus | undefined,
  ): ProjectQuestionnaireSnapshotLifecycleStatus {
    if (value === 'draft' || value === 'published' || value === 'superseded') {
      return value
    }

    return 'published'
  }

  private buildSnapshotResponse(
    snapshotRecord: SnapshotRecord,
    reusedExisting: boolean,
  ): ProjectQuestionnaireSnapshotResponseDto {
    const { task, metadata, questions } = snapshotRecord
    const lifecycleStatus = this.normalizeLifecycleStatus(metadata.lifecycleStatus)

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
      lifecycleStatus,
      publishedSnapshotTaskId:
        metadata.publishedSnapshotTaskId ??
        (lifecycleStatus === 'published' ? task.id : null),
      baseSnapshotTaskId: metadata.baseSnapshotTaskId ?? null,
      editVersion: Number(metadata.editVersion ?? 0),
      lastEditedAt: metadata.lastEditedAt ?? metadata.generatedAt,
      lastEditedBy: metadata.lastEditedBy ?? null,
      questions,
    }
  }

  private getNextSnapshotVersion(latestSnapshot: SnapshotRecord | null): number {
    const currentVersion = Number(latestSnapshot?.metadata.snapshotVersion ?? 0)
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
      question_template_id: question.questionId ?? null,
      source_question_id: question.questionId ?? null,
      control_id: question.controlId,
      cluster_id: question.controlId,
      cluster_name: controlPoint?.controlName ?? controlPoint?.controlCode ?? question.controlId,
      question_text: question.questionText,
      question_type: questionType,
      options,
      required: question.required,
      guidance: this.buildGuidance(question.required),
      display_order: index + 1,
      scoring_rule: this.normalizeScoringRule(question.scoringRule),
      is_project_custom: false,
    }
  }

  private mapQuestionType(questionType: string): SnapshotQuestion['question_type'] {
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
    runtimeType: SnapshotQuestion['question_type'],
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
          option_id: this.buildOptionId(index),
          text: option,
          score: index + 1,
        }
      }

      if (option && typeof option === 'object') {
        const record = option as Record<string, unknown>

        return {
          option_id:
            this.normalizeString(record.option_id) ??
            this.normalizeString(record.id) ??
            this.buildOptionId(index),
          text:
            this.normalizeString(record.text) ??
            this.normalizeString(record.label) ??
            String(record.value ?? `Option ${index + 1}`),
          score: typeof record.score === 'number' ? record.score : index + 1,
          level: this.normalizeNullableString(record.level),
          description: this.normalizeNullableString(record.description),
        }
      }

      throw new BadRequestException('Question answerSchema contains an unsupported option payload')
    })
  }

  private async normalizeDraftQuestions(
    questions: SaveProjectQuestionnaireSnapshotDraftQuestionDto[],
    baselineQuestions: SnapshotQuestion[],
  ): Promise<SnapshotQuestion[]> {
    const baselineById = new Map(
      baselineQuestions.map((question) => [question.question_id, question] as const),
    )
    const requestedControlIds = Array.from(
      new Set(
        questions.map((question) => {
          const baselineQuestion = question.questionId
            ? baselineById.get(question.questionId)
            : null

          return baselineQuestion?.control_id ?? question.controlId
        }),
      ),
    )
    const controlPoints = await this.controlPointRepository.find({
      where: {
        controlId: In(requestedControlIds),
      },
    })
    const controlById = new Map(
      controlPoints.map((control) => [control.controlId, control] as const),
    )
    const nextQuestions: SnapshotQuestion[] = []
    const seenQuestionIds = new Set<string>()
    const seenDisplayOrders = new Set<number>()

    for (const question of questions) {
      const baselineQuestion = question.questionId ? baselineById.get(question.questionId) : undefined
      const normalizedQuestion = this.normalizeDraftQuestion(
        question,
        baselineQuestion,
        controlById,
      )

      if (seenQuestionIds.has(normalizedQuestion.question_id)) {
        throw new BadRequestException(`Duplicate question id ${normalizedQuestion.question_id} in draft payload`)
      }
      if (seenDisplayOrders.has(normalizedQuestion.display_order)) {
        throw new BadRequestException(`Duplicate displayOrder ${normalizedQuestion.display_order} in draft payload`)
      }

      seenQuestionIds.add(normalizedQuestion.question_id)
      seenDisplayOrders.add(normalizedQuestion.display_order)
      nextQuestions.push(normalizedQuestion)
    }

    return nextQuestions.sort((left, right) => {
      if (left.display_order !== right.display_order) {
        return left.display_order - right.display_order
      }

      return left.question_id.localeCompare(right.question_id, 'en')
    })
  }

  private normalizeDraftQuestion(
    question: SaveProjectQuestionnaireSnapshotDraftQuestionDto,
    baselineQuestion: SnapshotQuestion | undefined,
    controlById: Map<string, ControlPoint>,
  ): SnapshotQuestion {
    const baselineControlId = baselineQuestion?.control_id ?? baselineQuestion?.cluster_id
    const controlId = baselineControlId ?? question.controlId?.trim()

    if (!controlId) {
      throw new BadRequestException('Question controlId is required')
    }

    if (baselineControlId && question.controlId !== baselineControlId) {
      throw new BadRequestException(
        `Question ${baselineQuestion.question_id} cannot change controlId from ${baselineControlId} to ${question.controlId}`,
      )
    }

    const controlPoint = controlById.get(controlId)

    if (!controlPoint) {
      throw new BadRequestException(`Control ${controlId} does not exist`)
    }

    const baselineQuestionType = baselineQuestion?.question_type
    const requestedQuestionType = question.questionType?.toUpperCase()

    if (
      baselineQuestionType &&
      requestedQuestionType &&
      requestedQuestionType !== baselineQuestionType
    ) {
      throw new BadRequestException(
        `Question ${baselineQuestion.question_id} cannot change questionType from ${baselineQuestionType} to ${question.questionType}`,
      )
    }

    const questionType = baselineQuestionType ?? this.mapQuestionType(question.questionType)
    const questionTemplateId =
      baselineQuestion?.question_template_id ??
      baselineQuestion?.source_question_id ??
      (question.questionTemplateId ?? null)

    if (
      baselineQuestion &&
      question.questionTemplateId !== undefined &&
      (question.questionTemplateId ?? null) !== (questionTemplateId ?? null)
    ) {
      throw new BadRequestException(
        `Question ${baselineQuestion.question_id} cannot change questionItemTemplateId`,
      )
    }

    const questionId =
      baselineQuestion?.question_id ?? question.questionId?.trim() ?? `project-custom-${randomUUID()}`
    const questionText = question.questionText.trim()

    if (!questionText) {
      throw new BadRequestException(`Question ${questionId} is missing questionText`)
    }

    const options = this.normalizeDraftOptions(question.options, questionType, questionId)

    return {
      question_id: questionId,
      question_template_id: questionTemplateId,
      source_question_id:
        baselineQuestion?.source_question_id ?? questionTemplateId,
      control_id: controlId,
      cluster_id: controlId,
      cluster_name: controlPoint.controlName ?? controlPoint.controlCode ?? controlId,
      question_text: questionText,
      question_type: questionType,
      options,
      required: Boolean(question.required),
      guidance: baselineQuestion?.guidance ?? this.buildGuidance(Boolean(question.required)),
      display_order: question.displayOrder,
      scoring_rule: this.normalizeScoringRule(question.scoringRule ?? baselineQuestion?.scoring_rule ?? null),
      is_project_custom: baselineQuestion?.is_project_custom ?? !baselineQuestion,
    }
  }

  private normalizeDraftOptions(
    options: SaveProjectQuestionnaireSnapshotDraftOptionDto[],
    questionType: SnapshotQuestion['question_type'],
    questionId: string,
  ): SnapshotQuestionOption[] {
    if (!Array.isArray(options) || options.length === 0) {
      throw new BadRequestException(`Question ${questionId} must include at least one option`)
    }

    if (
      (questionType === 'SINGLE_CHOICE' || questionType === 'MULTIPLE_CHOICE') &&
      options.length < 2
    ) {
      throw new BadRequestException(`Question ${questionId} must include at least two options`)
    }

    const seenOptionIds = new Set<string>()

    return options.map((option, index) => {
      const optionId = option.optionId?.trim() || this.buildOptionId(index)
      const text = option.text.trim()

      if (!text) {
        throw new BadRequestException(`Question ${questionId} contains an empty option label`)
      }

      if (seenOptionIds.has(optionId)) {
        throw new BadRequestException(`Question ${questionId} contains duplicate option id ${optionId}`)
      }

      seenOptionIds.add(optionId)

      return {
        option_id: optionId,
        text,
        score: option.score,
        level: option.level?.trim() || undefined,
        description: option.description?.trim() || undefined,
      }
    })
  }

  private buildNewDraftMetadata(
    publishedMetadata: SnapshotMetadata,
    questions: SnapshotQuestion[],
    snapshotVersion: number,
    publishedSnapshotTaskId: string,
    currentUserId: string,
    now: string,
  ): SnapshotMetadata {
    return {
      ...publishedMetadata,
      generatedAt: now,
      snapshotVersion,
      total_questions: questions.length,
      estimated_time_minutes: this.estimateTimeMinutes(questions.length),
      coverage_map: this.buildCoverageMap(questions),
      missingQuestionControlIds: this.filterMissingQuestionControlIds(
        publishedMetadata.missingQuestionControlIds,
        questions,
      ),
      lifecycleStatus: 'draft',
      publishedSnapshotTaskId,
      baseSnapshotTaskId: publishedSnapshotTaskId,
      editVersion: 1,
      lastEditedAt: now,
      lastEditedBy: currentUserId,
    }
  }

  private buildUpdatedDraftMetadata(
    existingMetadata: SnapshotMetadata,
    questions: SnapshotQuestion[],
    publishedSnapshotTaskId: string,
    currentUserId: string,
    now: string,
  ): SnapshotMetadata {
    return {
      ...existingMetadata,
      total_questions: questions.length,
      estimated_time_minutes: this.estimateTimeMinutes(questions.length),
      coverage_map: this.buildCoverageMap(questions),
      missingQuestionControlIds: this.filterMissingQuestionControlIds(
        existingMetadata.missingQuestionControlIds,
        questions,
      ),
      lifecycleStatus: 'draft',
      publishedSnapshotTaskId,
      baseSnapshotTaskId: existingMetadata.baseSnapshotTaskId ?? publishedSnapshotTaskId,
      editVersion: Number(existingMetadata.editVersion ?? 0) + 1,
      lastEditedAt: now,
      lastEditedBy: currentUserId,
    }
  }

  private filterMissingQuestionControlIds(
    missingQuestionControlIds: string[],
    questions: SnapshotQuestion[],
  ): string[] {
    const coveredControlIds = new Set(questions.map((question) => question.control_id))
    return (missingQuestionControlIds ?? []).filter((controlId) => !coveredControlIds.has(controlId))
  }

  private buildCoverageMap(questions: SnapshotQuestion[]): Record<string, number> {
    return questions.reduce<Record<string, number>>((acc, question) => {
      acc[question.cluster_id] = (acc[question.cluster_id] ?? 0) + 1
      return acc
    }, {})
  }

  private estimateTimeMinutes(questionCount: number): number {
    return Math.max(1, Math.ceil(questionCount * 0.5))
  }

  private buildGuidance(required: boolean): string {
    return required
      ? '此题为必答题，请选择最符合当前控制现状的选项。'
      : '请根据项目当前实际情况填写。'
  }

  private buildOptionId(index: number): string {
    return String.fromCharCode(65 + index)
  }

  private normalizeScoringRule(value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined) {
      return null
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('scoringRule must be an object or null')
    }

    return value as Record<string, unknown>
  }

  private normalizeString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  private normalizeNullableString(value: unknown): string | null {
    return this.normalizeString(value) ?? null
  }

  private buildPublishImpact(
    previousPublishedQuestions: SnapshotQuestion[],
    nextPublishedQuestions: SnapshotQuestion[],
    previousPublishedSnapshotTaskId: string | null,
    nextPublishedSnapshotTaskId: string,
    projectId: string,
  ): NonNullable<SnapshotMetadata['lastPublishedImpact']> {
    if (!previousPublishedSnapshotTaskId) {
      return {
        requiresDownstreamRefresh: false,
        staleTargets: [],
        changeTypes: [],
        message: '这是该项目问卷的首次发布，不会让已有差距分析、行动计划或报告失效。',
      }
    }

    const previousById = new Map(
      previousPublishedQuestions.map((question) => [question.question_id, question] as const),
    )
    const nextById = new Map(
      nextPublishedQuestions.map((question) => [question.question_id, question] as const),
    )
    const changeTypes = new Set<ProjectQuestionnaireChangeType>()

    nextPublishedQuestions.forEach((question) => {
      if (!previousById.has(question.question_id)) {
        changeTypes.add('question_added')
      }
    })

    previousPublishedQuestions.forEach((question) => {
      if (!nextById.has(question.question_id)) {
        changeTypes.add('question_removed')
      }
    })

    nextPublishedQuestions.forEach((question) => {
      const previousQuestion = previousById.get(question.question_id)
      if (!previousQuestion) {
        return
      }

      if (previousQuestion.question_text !== question.question_text) {
        changeTypes.add('question_text')
      }

      if (previousQuestion.required !== question.required) {
        changeTypes.add('required')
      }

      if (previousQuestion.display_order !== question.display_order) {
        changeTypes.add('display_order')
      }

      if (
        JSON.stringify(previousQuestion.scoring_rule ?? null) !==
        JSON.stringify(question.scoring_rule ?? null)
      ) {
        changeTypes.add('scoring_rule')
      }

      const previousOptionsById = new Map(
        previousQuestion.options.map((option) => [option.option_id, option] as const),
      )
      question.options.forEach((option) => {
        const previousOption = previousOptionsById.get(option.option_id)
        if (!previousOption) {
          changeTypes.add('option_score')
          return
        }

        if (previousOption.text !== option.text) {
          changeTypes.add('option_text')
        }

        if (previousOption.score !== option.score) {
          changeTypes.add('option_score')
        }
      })
    })

    const orderedChangeTypes = Array.from(changeTypes.values())
    const requiresDownstreamRefresh = orderedChangeTypes.some((changeType) =>
      ['question_added', 'question_removed', 'option_score', 'scoring_rule', 'required'].includes(
        changeType,
      ),
    )

    if (!requiresDownstreamRefresh) {
      return {
        requiresDownstreamRefresh: false,
        staleTargets: [],
        changeTypes: orderedChangeTypes,
        message:
          '本次重发布仅影响问卷展示文案或排序，不会让已有差距分析、行动计划或报告失效。',
      }
    }

    const staleTargets: ProjectQuestionnaireStaleTarget[] = [
      'gap-analysis',
      'action-plan',
      'report',
    ]

    return {
      requiresDownstreamRefresh: true,
      staleTargets,
      changeTypes: orderedChangeTypes,
      message: `项目 ${projectId} 的问卷已从 ${previousPublishedSnapshotTaskId} 重发布到 ${nextPublishedSnapshotTaskId}；现有差距分析、行动计划和报告需重新生成。`,
    }
  }
}
