import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator'
import {
  QUESTION_ITEM_STATUSES,
  QUESTION_ITEM_TYPES,
  QuestionItemStatus,
  QuestionItemType,
} from '../../../database/entities/question-item.entity'

class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20
}

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  if (value === true || value === 'true') {
    return true
  }
  if (value === false || value === 'false') {
    return false
  }
  return value
}

export class QueryQuestionItemDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  controlId?: string

  @IsOptional()
  @IsEnum(QUESTION_ITEM_TYPES)
  questionType?: QuestionItemType

  @IsOptional()
  @IsEnum(QUESTION_ITEM_STATUSES)
  status?: QuestionItemStatus

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  required?: boolean

  @IsOptional()
  @IsString()
  @Length(1, 200)
  keyword?: string
}

export class CreateQuestionItemDto {
  @IsUUID()
  controlId: string

  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9._-]+$/)
  questionCode: string

  @IsString()
  @Length(1, 4000)
  questionText: string

  @IsEnum(QUESTION_ITEM_TYPES)
  questionType: QuestionItemType

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  roleHint?: string[] | null

  @IsOptional()
  @IsObject()
  answerSchema?: Record<string, unknown> | null

  @IsOptional()
  @IsObject()
  scoringRule?: Record<string, unknown> | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  applicableTags?: string[] | null

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  required?: boolean = true

  @IsOptional()
  @IsEnum(QUESTION_ITEM_STATUSES)
  status?: QuestionItemStatus = 'ACTIVE'
}

export class UpdateQuestionItemDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  controlId?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9._-]+$/)
  questionCode?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 4000)
  questionText?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(QUESTION_ITEM_TYPES)
  questionType?: QuestionItemType

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  roleHint?: string[] | null

  @IsOptional()
  @IsObject()
  answerSchema?: Record<string, unknown> | null

  @IsOptional()
  @IsObject()
  scoringRule?: Record<string, unknown> | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  applicableTags?: string[] | null

  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Boolean)
  @IsBoolean()
  required?: boolean

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(QUESTION_ITEM_STATUSES)
  status?: QuestionItemStatus
}
