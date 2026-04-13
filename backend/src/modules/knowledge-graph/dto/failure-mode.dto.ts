import { Type } from 'class-transformer'
import {
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
import {
  FAILURE_MODE_CATEGORIES,
  FAILURE_MODE_STATUSES,
  FailureModeCategory,
  FailureModeStatus,
} from '../../../database/entities/failure-mode.entity'
import {
  FAILURE_MODE_CONTROL_RELEVANCES,
  FailureModeControlRelevance,
} from '../../../database/entities/failure-mode-control-map.entity'

// ---------------------------------------------------------------------------
// Pagination base (mirrors PaginationDto in evidence.dto.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Query DTO
// ---------------------------------------------------------------------------

export class QueryFailureModeDto extends PaginationDto {
  @IsOptional()
  @IsIn([...FAILURE_MODE_CATEGORIES])
  category?: FailureModeCategory

  @IsOptional()
  @IsIn([...FAILURE_MODE_STATUSES])
  status?: FailureModeStatus

  @IsOptional()
  @IsString()
  @Length(1, 200)
  keyword?: string
}

// ---------------------------------------------------------------------------
// Create / Update DTOs for FailureMode
// ---------------------------------------------------------------------------

export class CreateFailureModeDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  failureModeCode: string

  @IsString()
  @IsNotEmpty()
  @Length(1, 300)
  name: string

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  description?: string | null

  @IsIn([...FAILURE_MODE_CATEGORIES])
  category: FailureModeCategory

  @IsOptional()
  @IsIn([...FAILURE_MODE_STATUSES])
  status?: FailureModeStatus
}

export class UpdateFailureModeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  failureModeCode?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 300)
  name?: string

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  description?: string | null

  @IsOptional()
  @IsIn([...FAILURE_MODE_CATEGORIES])
  category?: FailureModeCategory

  @IsOptional()
  @IsIn([...FAILURE_MODE_STATUSES])
  status?: FailureModeStatus
}

// ---------------------------------------------------------------------------
// Create DTOs for mapping tables
// ---------------------------------------------------------------------------

export class CreateTaxonomyFailureModeMapDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  l2Code: string

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  notes?: string | null
}

export class CreateFailureModeControlMapDto {
  @IsUUID()
  controlId: string

  @IsIn([...FAILURE_MODE_CONTROL_RELEVANCES])
  relevance: FailureModeControlRelevance

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  notes?: string | null
}
