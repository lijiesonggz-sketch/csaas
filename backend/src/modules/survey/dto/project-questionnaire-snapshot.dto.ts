import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

export const PROJECT_QUESTIONNAIRE_SNAPSHOT_LIFECYCLE = ['draft', 'published', 'superseded'] as const
export type ProjectQuestionnaireSnapshotLifecycleStatus =
  (typeof PROJECT_QUESTIONNAIRE_SNAPSHOT_LIFECYCLE)[number]

export const PROJECT_QUESTIONNAIRE_STALE_TARGETS = [
  'gap-analysis',
  'action-plan',
  'report',
] as const
export type ProjectQuestionnaireStaleTarget =
  (typeof PROJECT_QUESTIONNAIRE_STALE_TARGETS)[number]

export const PROJECT_QUESTIONNAIRE_CHANGE_TYPES = [
  'question_text',
  'option_text',
  'option_score',
  'scoring_rule',
  'question_added',
  'question_removed',
  'required',
  'display_order',
] as const
export type ProjectQuestionnaireChangeType =
  (typeof PROJECT_QUESTIONNAIRE_CHANGE_TYPES)[number]

export const PROJECT_QUESTIONNAIRE_EDITABLE_QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'RATING',
] as const
export type ProjectQuestionnaireEditableQuestionType =
  (typeof PROJECT_QUESTIONNAIRE_EDITABLE_QUESTION_TYPES)[number]

export class CreateProjectQuestionnaireSnapshotDto {
  @IsUUID()
  projectId!: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  regenerate?: boolean
}

export class SaveProjectQuestionnaireSnapshotDraftOptionDto {
  @IsOptional()
  @IsString()
  optionId?: string

  @IsString()
  @IsNotEmpty()
  text!: string

  @Type(() => Number)
  @IsInt()
  score!: number

  @IsOptional()
  @IsString()
  level?: string

  @IsOptional()
  @IsString()
  description?: string
}

export class SaveProjectQuestionnaireSnapshotDraftQuestionDto {
  @IsOptional()
  @IsString()
  questionId?: string

  @IsOptional()
  @IsString()
  questionTemplateId?: string | null

  @IsString()
  @IsNotEmpty()
  controlId!: string

  @IsString()
  @IsIn(PROJECT_QUESTIONNAIRE_EDITABLE_QUESTION_TYPES)
  questionType!: ProjectQuestionnaireEditableQuestionType

  @IsString()
  @IsNotEmpty()
  questionText!: string

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveProjectQuestionnaireSnapshotDraftOptionDto)
  options!: SaveProjectQuestionnaireSnapshotDraftOptionDto[]

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsObject()
  @IsOptional()
  scoringRule?: Record<string, unknown> | null

  @Type(() => Boolean)
  @IsBoolean()
  required!: boolean

  @Type(() => Number)
  @IsInt()
  @Min(1)
  displayOrder!: number
}

export class SaveProjectQuestionnaireSnapshotDraftDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveProjectQuestionnaireSnapshotDraftQuestionDto)
  questions!: SaveProjectQuestionnaireSnapshotDraftQuestionDto[]
}

export class ProjectQuestionnaireSnapshotResponseDto {
  projectId!: string
  organizationId!: string
  questionnaireTaskId!: string
  generatedAt!: string
  snapshotVersion!: number
  resolvedControlSetVersion!: string
  questionSetVersion!: string
  sourceControlIds!: string[]
  missingQuestionControlIds!: string[]
  reusedExisting!: boolean
  lifecycleStatus!: ProjectQuestionnaireSnapshotLifecycleStatus
  publishedSnapshotTaskId!: string | null
  baseSnapshotTaskId!: string | null
  editVersion!: number
  lastEditedAt!: string | null
  lastEditedBy!: string | null
  questions!: Array<Record<string, unknown>>
}

export class ProjectQuestionnairePublishImpactResponseDto {
  projectId!: string
  questionnaireTaskId!: string
  publishedSnapshotTaskId!: string | null
  requiresDownstreamRefresh!: boolean
  staleTargets!: ProjectQuestionnaireStaleTarget[]
  changeTypes!: ProjectQuestionnaireChangeType[]
  message!: string
}

export class ProjectQuestionnaireFreshnessResponseDto {
  projectId!: string
  surveyResponseId!: string
  questionnaireTaskId!: string
  latestPublishedSnapshotTaskId!: string | null
  isStale!: boolean
  staleTargets!: ProjectQuestionnaireStaleTarget[]
  changeTypes!: ProjectQuestionnaireChangeType[]
  message!: string | null
}
