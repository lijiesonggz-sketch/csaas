import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

export const THINKTANK_MESSAGE_MAX_LENGTH = 5000

export class SubmitAdvisoryMessageDto {
  @IsString()
  @MaxLength(THINKTANK_MESSAGE_MAX_LENGTH)
  content: string

  @IsOptional()
  @IsString()
  @IsIn(['continue', 'deepen', 'revise', 'party-mode'])
  decisionAction?: string
}
