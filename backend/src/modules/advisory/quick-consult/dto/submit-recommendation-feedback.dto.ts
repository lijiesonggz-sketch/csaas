import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export const QUICK_CONSULT_RECOMMENDATION_FEEDBACK_MAX_LENGTH = 2000

export class SubmitRecommendationFeedbackDto {
  @IsUUID()
  quickConsultContextId: string

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  recommendationIds?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(QUICK_CONSULT_RECOMMENDATION_FEEDBACK_MAX_LENGTH)
  feedbackText?: string
}
