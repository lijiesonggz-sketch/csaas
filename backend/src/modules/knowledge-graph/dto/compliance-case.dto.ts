import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
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
  CASE_CONTROL_RELATION_TYPES,
  CaseControlRelationType,
} from '../../../database/entities/case-control-map.entity'
import {
  MAP_REVIEW_STATUSES,
  MapReviewStatus,
} from '../../../database/entities/clause-control-map.entity'
import {
  COMPLIANCE_CASE_STATUSES,
  ComplianceCaseStatus,
} from '../../../database/entities/compliance-case.entity'

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

export class QueryComplianceCaseDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  batchId?: string

  @IsOptional()
  @IsString()
  @Length(1, 100)
  caseCode?: string

  @IsOptional()
  @IsString()
  @Length(1, 50)
  industry?: string

  @IsOptional()
  @IsString()
  @Length(1, 200)
  authorityName?: string

  @IsOptional()
  @IsString()
  @Length(1, 20)
  regulatorCode?: string

  @IsOptional()
  @IsEnum(COMPLIANCE_CASE_STATUSES)
  status?: ComplianceCaseStatus

  @IsOptional()
  @IsString()
  @Length(1, 200)
  keyword?: string
}

export class CreateComplianceCaseDto {
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9._-]+$/)
  caseCode: string

  @IsOptional()
  @IsString()
  @Length(1, 20)
  regulatorCode?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 500)
  caseTitle?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 200)
  sourceOrg?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 50)
  industry?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 100)
  region?: string | null

  @IsOptional()
  @IsDateString()
  caseDate?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 200)
  authorityName?: string | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  penaltyType?: string[] | null

  @IsOptional()
  @IsString()
  @Length(1, 10000)
  caseFacts?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 10000)
  penaltyReason?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  rawSourceUrl?: string | null

  @IsOptional()
  @IsUUID()
  rawContentId?: string | null

  @IsOptional()
  @IsString()
  @Length(4, 20)
  @Matches(/^IT\d{2}$/)
  l1Code?: string | null

  @IsOptional()
  @IsString()
  @Length(7, 20)
  @Matches(/^IT\d{2}-\d{2}$/)
  l2Code?: string | null

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  confidenceScore?: number | null

  @IsOptional()
  @IsString()
  @Length(1, 100)
  importBatchId?: string | null

  @IsOptional()
  @IsEnum(COMPLIANCE_CASE_STATUSES)
  status?: ComplianceCaseStatus = 'pending'
}

export class UpdateComplianceCaseDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9._-]+$/)
  caseCode?: string

  @IsOptional()
  @IsString()
  @Length(1, 20)
  regulatorCode?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 500)
  caseTitle?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 200)
  sourceOrg?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 50)
  industry?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 100)
  region?: string | null

  @IsOptional()
  @IsDateString()
  caseDate?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 200)
  authorityName?: string | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  penaltyType?: string[] | null

  @IsOptional()
  @IsString()
  @Length(1, 10000)
  caseFacts?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 10000)
  penaltyReason?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  rawSourceUrl?: string | null

  @IsOptional()
  @IsUUID()
  rawContentId?: string | null

  @IsOptional()
  @IsString()
  @Length(4, 20)
  @Matches(/^IT\d{2}$/)
  l1Code?: string | null

  @IsOptional()
  @IsString()
  @Length(7, 20)
  @Matches(/^IT\d{2}-\d{2}$/)
  l2Code?: string | null

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  confidenceScore?: number | null

  @IsOptional()
  @IsString()
  @Length(1, 100)
  importBatchId?: string | null

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(COMPLIANCE_CASE_STATUSES)
  status?: ComplianceCaseStatus
}

export class QueryCaseControlMapDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  caseId?: string

  @IsOptional()
  @IsUUID()
  controlId?: string

  @IsOptional()
  @IsEnum(CASE_CONTROL_RELATION_TYPES)
  relationType?: CaseControlRelationType

  @IsOptional()
  @IsEnum(MAP_REVIEW_STATUSES)
  reviewStatus?: MapReviewStatus
}

export class CreateCaseControlMapDto {
  @IsUUID()
  caseId: string

  @IsUUID()
  controlId: string

  @IsOptional()
  @IsEnum(CASE_CONTROL_RELATION_TYPES)
  relationType?: CaseControlRelationType = 'VIOLATES'

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  confidenceScore?: number | null

  @IsOptional()
  @IsEnum(MAP_REVIEW_STATUSES)
  reviewStatus?: MapReviewStatus = 'PENDING'
}

export class UpdateCaseControlMapDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  caseId?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  controlId?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(CASE_CONTROL_RELATION_TYPES)
  relationType?: CaseControlRelationType

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  confidenceScore?: number | null

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(MAP_REVIEW_STATUSES)
  reviewStatus?: MapReviewStatus
}
