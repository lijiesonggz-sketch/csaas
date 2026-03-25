export class MissingAnswerDto {
  questionId!: string
  reason!: 'missing' | 'invalid'
}

export class ControlGapInputItemDto {
  controlId!: string
  questionIds!: string[]
  currentStatus!: 'COMPLIANT' | 'PARTIAL' | 'INCOMPLETE'
  gapLevel!: 'LOW' | 'MEDIUM' | 'HIGH'
  missingAnswers!: MissingAnswerDto[]
  riskHints!: string[]
}

export class ControlGapInputResponseDto {
  surveyResponseId!: string
  questionnaireTaskId!: string
  projectId!: string
  controls!: ControlGapInputItemDto[]
}
