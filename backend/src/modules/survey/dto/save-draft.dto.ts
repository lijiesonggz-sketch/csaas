import { IsObject, IsNumber, IsOptional, Min, Max } from 'class-validator'

/**
 * 保存问卷草稿DTO
 */
export class SaveDraftDto {
  @IsObject()
  answers: Record<string, any>

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage?: number

  @IsOptional()
  @IsNumber()
  totalScore?: number

  @IsOptional()
  @IsNumber()
  maxScore?: number
}
