import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { THINKTANK_MESSAGE_MAX_LENGTH } from '../../sessions/dto/submit-advisory-message.dto'

export const QUICK_CONSULT_PROBLEM_MAX_LENGTH = THINKTANK_MESSAGE_MAX_LENGTH
const QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE = '问题描述过长，请精简到 5000 字符以内。'

export class QuickConsultClarificationAnswerDto {
  @IsString()
  @MaxLength(QUICK_CONSULT_PROBLEM_MAX_LENGTH, {
    message: QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE,
  })
  question: string

  @IsString()
  @MaxLength(QUICK_CONSULT_PROBLEM_MAX_LENGTH, {
    message: QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE,
  })
  answer: string
}

export class StartQuickConsultDto {
  @IsString()
  @MaxLength(QUICK_CONSULT_PROBLEM_MAX_LENGTH, {
    message: QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE,
  })
  problem: string

  @IsOptional()
  @IsUUID()
  contextId?: string

  @IsOptional()
  @IsString()
  @MaxLength(QUICK_CONSULT_PROBLEM_MAX_LENGTH, {
    message: QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE,
  })
  originalProblem?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuickConsultClarificationAnswerDto)
  clarificationAnswers?: QuickConsultClarificationAnswerDto[]
}
