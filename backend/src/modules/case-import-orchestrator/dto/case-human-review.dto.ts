import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'
import {
  CASE_CONTROL_RELATION_TYPES,
  CaseControlRelationType,
} from '../../../database/entities/case-control-map.entity'
import { ComplianceCaseControlPointDraft } from '../../../database/entities/compliance-case.entity'

class ManualCaseControlMapDto {
  @IsUUID()
  controlId: string

  @IsOptional()
  @IsEnum(CASE_CONTROL_RELATION_TYPES)
  relationType?: CaseControlRelationType = 'VIOLATES'

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  confidenceScore?: number
}

class CandidateControlPointDto implements ComplianceCaseControlPointDraft {
  @IsString()
  @Length(1, 300)
  controlName: string

  @IsString()
  @Length(1, 300)
  sourceTheme: string

  @Type(() => Number)
  @Min(0)
  @Max(1)
  confidenceScore: number

  @IsString()
  @Length(1, 500)
  reason: string
}

export class CaseHumanReviewDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  approvedMapIds?: string[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  rejectedMapIds?: string[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ManualCaseControlMapDto)
  manualMappings?: ManualCaseControlMapDto[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CandidateControlPointDto)
  candidateControlPoints?: CandidateControlPointDto[]
}
