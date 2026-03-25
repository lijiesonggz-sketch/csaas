import { IsUUID } from 'class-validator'

export class OrganizationQuestionSetRequestDto {
  @IsUUID()
  organizationId!: string
}

export class OrganizationQuestionSetQuestionDto {
  questionId!: string
  controlId!: string
  questionCode!: string
  questionText!: string
  questionType!: string
  answerSchema!: Record<string, unknown> | null
  scoringRule!: Record<string, unknown> | null
  required!: boolean
}

export class OrganizationQuestionSetSummaryDto {
  totalControls!: number
  controlsWithQuestions!: number
  missingQuestionControls!: number
  totalQuestions!: number
}

export class OrganizationQuestionSetResponseDto {
  organizationId!: string
  questions!: OrganizationQuestionSetQuestionDto[]
  missingQuestionControlIds!: string[]
  summary!: OrganizationQuestionSetSummaryDto
}
