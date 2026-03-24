import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
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
  CLAUSE_CONTROL_MAPPING_TYPES,
  MAP_REVIEW_STATUSES,
  ClauseControlMappingType,
  MapReviewStatus,
} from '../../../database/entities/clause-control-map.entity'
import {
  REGULATION_CLAUSE_MANDATORY_LEVELS,
  RegulationClauseMandatoryLevel,
} from '../../../database/entities/regulation-clause.entity'
import {
  REGULATION_SOURCE_LEVELS,
  REGULATION_SOURCE_STATUSES,
  RegulationSourceLevel,
  RegulationSourceStatus,
} from '../../../database/entities/regulation-source.entity'

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

export class QueryRegulationSourceDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sourceCode?: string

  @IsOptional()
  @IsEnum(REGULATION_SOURCE_LEVELS)
  sourceLevel?: RegulationSourceLevel

  @IsOptional()
  @IsEnum(REGULATION_SOURCE_STATUSES)
  sourceStatus?: RegulationSourceStatus

  @IsOptional()
  @IsString()
  @Length(1, 200)
  keyword?: string
}

export class CreateRegulationSourceDto {
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9._-]+$/)
  sourceCode: string

  @IsString()
  @Length(1, 300)
  sourceName: string

  @IsEnum(REGULATION_SOURCE_LEVELS)
  sourceLevel: RegulationSourceLevel

  @IsOptional()
  @IsString()
  @Length(1, 200)
  authorityName?: string | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  industryScope?: string[] | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  applicableOrgTypes?: string[] | null

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 50)
  versionNo?: string | null

  @IsOptional()
  @IsEnum(REGULATION_SOURCE_STATUSES)
  sourceStatus?: RegulationSourceStatus = 'ACTIVE'

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  rawTextPath?: string | null

  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, unknown> | null
}

export class UpdateRegulationSourceDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9._-]+$/)
  sourceCode?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 300)
  sourceName?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(REGULATION_SOURCE_LEVELS)
  sourceLevel?: RegulationSourceLevel

  @IsOptional()
  @IsString()
  @Length(1, 200)
  authorityName?: string | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  industryScope?: string[] | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  applicableOrgTypes?: string[] | null

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 50)
  versionNo?: string | null

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(REGULATION_SOURCE_STATUSES)
  sourceStatus?: RegulationSourceStatus

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  rawTextPath?: string | null

  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, unknown> | null
}

export class QueryRegulationClauseDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  sourceId?: string

  @IsOptional()
  @IsEnum(REGULATION_CLAUSE_MANDATORY_LEVELS)
  mandatoryLevel?: RegulationClauseMandatoryLevel

  @IsOptional()
  @IsString()
  @Length(1, 200)
  keyword?: string
}

export class CreateRegulationClauseDto {
  @IsUUID()
  sourceId: string

  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9._-]+$/)
  clauseCode: string

  @IsOptional()
  @IsString()
  @Length(1, 100)
  articleNo?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 500)
  sectionPath?: string | null

  @IsString()
  @Length(1, 20000)
  clauseText: string

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  clauseSummary?: string | null

  @IsOptional()
  @IsEnum(REGULATION_CLAUSE_MANDATORY_LEVELS)
  mandatoryLevel?: RegulationClauseMandatoryLevel | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  keywords?: string[] | null

  @IsOptional()
  @IsString()
  @Length(1, 100)
  embeddingId?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 50)
  versionNo?: string | null

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null
}

export class UpdateRegulationClauseDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  sourceId?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9._-]+$/)
  clauseCode?: string

  @IsOptional()
  @IsString()
  @Length(1, 100)
  articleNo?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 500)
  sectionPath?: string | null

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 20000)
  clauseText?: string

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  clauseSummary?: string | null

  @IsOptional()
  @IsEnum(REGULATION_CLAUSE_MANDATORY_LEVELS)
  mandatoryLevel?: RegulationClauseMandatoryLevel | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  keywords?: string[] | null

  @IsOptional()
  @IsString()
  @Length(1, 100)
  embeddingId?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 50)
  versionNo?: string | null

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null
}

export class QueryClauseControlMapDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  clauseId?: string

  @IsOptional()
  @IsUUID()
  controlId?: string

  @IsOptional()
  @IsEnum(CLAUSE_CONTROL_MAPPING_TYPES)
  mappingType?: ClauseControlMappingType

  @IsOptional()
  @IsEnum(MAP_REVIEW_STATUSES)
  reviewStatus?: MapReviewStatus
}

export class CreateClauseControlMapDto {
  @IsUUID()
  clauseId: string

  @IsUUID()
  controlId: string

  @IsEnum(CLAUSE_CONTROL_MAPPING_TYPES)
  mappingType: ClauseControlMappingType

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  confidenceScore?: number | null

  @IsOptional()
  @IsEnum(MAP_REVIEW_STATUSES)
  reviewStatus?: MapReviewStatus = 'PENDING'

  @IsOptional()
  @IsUUID()
  reviewerId?: string | null

  @IsOptional()
  @IsDateString()
  reviewedAt?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  notes?: string | null
}

export class UpdateClauseControlMapDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  clauseId?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  controlId?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(CLAUSE_CONTROL_MAPPING_TYPES)
  mappingType?: ClauseControlMappingType

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  confidenceScore?: number | null

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(MAP_REVIEW_STATUSES)
  reviewStatus?: MapReviewStatus

  @IsOptional()
  @IsUUID()
  reviewerId?: string | null

  @IsOptional()
  @IsDateString()
  reviewedAt?: string | null

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  notes?: string | null
}
