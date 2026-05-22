import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

export const THINKTANK_MESSAGE_MAX_LENGTH = 5000
export const THINKTANK_DECISION_ACTIONS = [
  'continue',
  'deepen',
  'revise',
  'party-mode',
  'return-to-workflow',
  'integrate-party-mode',
  'accept-party-mode-conclusion',
  'retry-party-mode-advisor',
  'continue-party-mode',
] as const

export class SubmitAdvisoryMessageDto {
  @IsString()
  @MaxLength(THINKTANK_MESSAGE_MAX_LENGTH)
  content: string

  @IsOptional()
  @IsString()
  @IsIn(THINKTANK_DECISION_ACTIONS)
  decisionAction?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  addressedAdvisorId?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  addressedMessageId?: string
}
