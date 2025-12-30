import { IsObject, IsNumber, IsOptional, IsString } from 'class-validator'

/**
 * 提交问卷DTO
 */
export class SubmitSurveyDto {
  @IsObject()
  answers: Record<string, any>

  @IsNumber()
  totalScore: number

  @IsNumber()
  maxScore: number

  @IsOptional()
  @IsString()
  notes?: string
}
