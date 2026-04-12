import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator'
import {
  FAILURE_MODE_CATEGORIES,
  FAILURE_MODE_STATUSES,
  FailureModeCategory,
  FailureModeStatus,
} from '../../../database/entities/failure-mode.entity'

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
