import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator'
import { AITaskType } from '../../../database/entities/ai-task.entity'
import type {
  AuditWorkbenchRiskLevel,
  AuditWorkbenchSortBy,
  AuditWorkbenchSortOrder,
} from '../../compliance-intelligence/dto/audit-workbench-aggregate.dto'

const REVIEW_STATUSES = ['pending', 'approved', 'modified', 'rejected'] as const
const RISK_LEVELS = ['high', 'medium', 'low'] as const
const SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'confidenceLevel',
  'reviewStatus',
  'riskLevel',
  'title',
] as const
const SORT_ORDERS = ['asc', 'desc'] as const

function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export class ProjectReviewQueryDto {
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
  pageSize?: number = 20

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsIn(REVIEW_STATUSES, { each: true })
  reviewStatus?: string[]

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsIn(RISK_LEVELS, { each: true })
  riskLevel?: AuditWorkbenchRiskLevel[]

  @IsOptional()
  @IsEnum(AITaskType)
  reviewStage?: AITaskType

  @IsOptional()
  @IsIn(SORT_FIELDS)
  sortBy?: AuditWorkbenchSortBy = 'updatedAt'

  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder?: AuditWorkbenchSortOrder = 'desc'
}
