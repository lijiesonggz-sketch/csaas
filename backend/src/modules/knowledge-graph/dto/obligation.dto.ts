import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator'
import { APPLICABLE_SECTORS } from '../../../database/entities/control-point.entity'
import {
  OBLIGATION_COVERAGES,
  ObligationCoverage,
} from '../../../database/entities/obligation-control-map.entity'
import {
  OBLIGATION_STATUSES,
  OBLIGATION_TYPES,
  ObligationStatus,
  ObligationType,
} from '../../../database/entities/regulation-obligation.entity'

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

export class QueryObligationDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  clauseId?: string

  @IsOptional()
  @IsIn([...OBLIGATION_TYPES])
  obligationType?: ObligationType

  @IsOptional()
  @IsIn([...OBLIGATION_STATUSES])
  status?: ObligationStatus

  @IsOptional()
  @IsIn([...APPLICABLE_SECTORS])
  applicableSector?: (typeof APPLICABLE_SECTORS)[number]

  @IsOptional()
  @IsString()
  @Length(1, 200)
  keyword?: string
}

export class CreateObligationDto {
  @IsUUID()
  clauseId: string

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  obligationCode: string

  @IsString()
  @IsNotEmpty()
  @Length(1, 20000)
  obligationText: string

  @IsIn([...OBLIGATION_TYPES])
  obligationType: ObligationType

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsIn([...APPLICABLE_SECTORS], { each: true })
  applicableSector?: (typeof APPLICABLE_SECTORS)[number][]

  @IsOptional()
  @IsIn([...OBLIGATION_STATUSES])
  status?: ObligationStatus
}

export class UpdateObligationDto {
  @IsOptional()
  @IsUUID()
  clauseId?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  obligationCode?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 20000)
  obligationText?: string

  @IsOptional()
  @IsIn([...OBLIGATION_TYPES])
  obligationType?: ObligationType

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsIn([...APPLICABLE_SECTORS], { each: true })
  applicableSector?: (typeof APPLICABLE_SECTORS)[number][]

  @IsOptional()
  @IsIn([...OBLIGATION_STATUSES])
  status?: ObligationStatus
}

export class QueryObligationControlMapDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  obligationId?: string

  @IsOptional()
  @IsUUID()
  controlId?: string

  @IsOptional()
  @IsIn([...OBLIGATION_COVERAGES])
  coverage?: ObligationCoverage
}

export class CreateObligationControlMapDto {
  @IsOptional()
  @IsUUID()
  obligationId?: string

  @IsUUID()
  controlId: string

  @IsIn([...OBLIGATION_COVERAGES])
  coverage: ObligationCoverage

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  notes?: string | null
}

export class UpdateObligationControlMapDto {
  @IsOptional()
  @IsUUID()
  obligationId?: string

  @IsOptional()
  @IsUUID()
  controlId?: string

  @IsOptional()
  @IsIn([...OBLIGATION_COVERAGES])
  coverage?: ObligationCoverage

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  notes?: string | null
}
