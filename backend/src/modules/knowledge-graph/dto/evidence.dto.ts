import { Type } from 'class-transformer'
import {
  IsBoolean,
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
  CONTROL_EVIDENCE_REQUIRED_LEVELS,
  ControlEvidenceRequiredLevel,
  EVIDENCE_FREQUENCIES,
  EVIDENCE_SAMPLING_REQUIREMENTS,
  EvidenceFrequency,
  EvidenceSamplingRequirement,
} from '../../../database/entities/control-evidence-map.entity'
import {
  EVIDENCE_CATEGORIES,
  EVIDENCE_TYPE_STATUSES,
  EvidenceCategory,
  EvidenceTypeStatus,
} from '../../../database/entities/evidence-type.entity'

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

export class QueryEvidenceTypeDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  evidenceCode?: string

  @IsOptional()
  @IsEnum(EVIDENCE_CATEGORIES)
  evidenceCategory?: EvidenceCategory

  @IsOptional()
  @IsEnum(EVIDENCE_TYPE_STATUSES)
  status?: EvidenceTypeStatus

  @IsOptional()
  @IsString()
  @Length(1, 200)
  keyword?: string
}

export class CreateEvidenceTypeDto {
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9._-]+$/)
  evidenceCode: string

  @IsString()
  @Length(1, 200)
  evidenceName: string

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  evidenceDesc?: string | null

  @IsOptional()
  @IsEnum(EVIDENCE_CATEGORIES)
  evidenceCategory?: EvidenceCategory | null

  @IsOptional()
  @IsEnum(EVIDENCE_TYPE_STATUSES)
  status?: EvidenceTypeStatus = 'ACTIVE'

  @IsOptional()
  @IsBoolean()
  autoCollectable?: boolean = false
}

export class UpdateEvidenceTypeDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Z0-9._-]+$/)
  evidenceCode?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 200)
  evidenceName?: string

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  evidenceDesc?: string | null

  @IsOptional()
  @IsEnum(EVIDENCE_CATEGORIES)
  evidenceCategory?: EvidenceCategory | null

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(EVIDENCE_TYPE_STATUSES)
  status?: EvidenceTypeStatus

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  autoCollectable?: boolean
}

export class QueryControlEvidenceMapDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  controlId?: string

  @IsOptional()
  @IsUUID()
  evidenceId?: string

  @IsOptional()
  @IsEnum(CONTROL_EVIDENCE_REQUIRED_LEVELS)
  requiredLevel?: ControlEvidenceRequiredLevel
}

export class CreateControlEvidenceMapDto {
  @IsUUID()
  controlId: string

  @IsUUID()
  evidenceId: string

  @IsOptional()
  @IsEnum(CONTROL_EVIDENCE_REQUIRED_LEVELS)
  requiredLevel?: ControlEvidenceRequiredLevel = 'RECOMMENDED'

  @IsOptional()
  @IsEnum(EVIDENCE_FREQUENCIES)
  frequency?: EvidenceFrequency | null

  @IsOptional()
  @IsString()
  @Length(1, 100)
  ownerRole?: string | null

  @IsOptional()
  @IsEnum(EVIDENCE_SAMPLING_REQUIREMENTS)
  samplingRequirement?: EvidenceSamplingRequirement | null

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  notes?: string | null
}

export class UpdateControlEvidenceMapDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  controlId?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  evidenceId?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(CONTROL_EVIDENCE_REQUIRED_LEVELS)
  requiredLevel?: ControlEvidenceRequiredLevel

  @IsOptional()
  @IsEnum(EVIDENCE_FREQUENCIES)
  frequency?: EvidenceFrequency | null

  @IsOptional()
  @IsString()
  @Length(1, 100)
  ownerRole?: string | null

  @IsOptional()
  @IsEnum(EVIDENCE_SAMPLING_REQUIREMENTS)
  samplingRequirement?: EvidenceSamplingRequirement | null

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  notes?: string | null
}
