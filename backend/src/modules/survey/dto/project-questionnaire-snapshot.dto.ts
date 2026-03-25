import { Type } from 'class-transformer'
import { IsBoolean, IsOptional, IsUUID } from 'class-validator'

export class CreateProjectQuestionnaireSnapshotDto {
  @IsUUID()
  projectId!: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  regenerate?: boolean
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
  questions!: Array<Record<string, unknown>>
}
