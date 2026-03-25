import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
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
  REMEDIATION_ACTION_BENEFIT_LEVELS,
  REMEDIATION_ACTION_EFFORT_LEVELS,
  REMEDIATION_ACTION_PRIORITIES,
  REMEDIATION_ACTION_STATUSES,
  RemediationActionBenefitLevel,
  RemediationActionEffortLevel,
  RemediationActionPriority,
  RemediationActionStatus,
} from '../../../database/entities/remediation-action.entity'

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

export class QueryRemediationActionDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  controlId?: string

  @IsOptional()
  @IsEnum(REMEDIATION_ACTION_PRIORITIES)
  priorityDefault?: RemediationActionPriority

  @IsOptional()
  @IsEnum(REMEDIATION_ACTION_STATUSES)
  status?: RemediationActionStatus

  @IsOptional()
  @IsString()
  @Length(1, 200)
  keyword?: string
}

export class CreateRemediationActionDto {
  @IsUUID()
  controlId: string

  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9._-]+$/)
  actionCode: string

  @IsString()
  @Length(1, 300)
  actionTitle: string

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  actionDesc?: string | null

  @IsOptional()
  @IsEnum(REMEDIATION_ACTION_PRIORITIES)
  priorityDefault?: RemediationActionPriority = 'MEDIUM'

  @IsOptional()
  @IsEnum(REMEDIATION_ACTION_EFFORT_LEVELS)
  effortLevel?: RemediationActionEffortLevel | null

  @IsOptional()
  @IsEnum(REMEDIATION_ACTION_BENEFIT_LEVELS)
  expectedBenefit?: RemediationActionBenefitLevel | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  ownerRoleHint?: string[] | null

  @IsOptional()
  @IsObject()
  outputTemplate?: Record<string, unknown> | null

  @IsOptional()
  @IsEnum(REMEDIATION_ACTION_STATUSES)
  status?: RemediationActionStatus = 'ACTIVE'
}

export class UpdateRemediationActionDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  controlId?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9._-]+$/)
  actionCode?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 300)
  actionTitle?: string

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  actionDesc?: string | null

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(REMEDIATION_ACTION_PRIORITIES)
  priorityDefault?: RemediationActionPriority

  @IsOptional()
  @IsEnum(REMEDIATION_ACTION_EFFORT_LEVELS)
  effortLevel?: RemediationActionEffortLevel | null

  @IsOptional()
  @IsEnum(REMEDIATION_ACTION_BENEFIT_LEVELS)
  expectedBenefit?: RemediationActionBenefitLevel | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  ownerRoleHint?: string[] | null

  @IsOptional()
  @IsObject()
  outputTemplate?: Record<string, unknown> | null

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(REMEDIATION_ACTION_STATUSES)
  status?: RemediationActionStatus
}
