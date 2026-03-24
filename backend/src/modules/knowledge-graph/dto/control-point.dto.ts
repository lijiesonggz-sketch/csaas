import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
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
  CONTROL_POINT_RISK_LEVELS,
  CONTROL_POINT_STATUSES,
  CONTROL_POINT_TYPES,
  ControlPointRiskLevel,
  ControlPointStatus,
  ControlPointType,
} from '../../../database/entities/control-point.entity'

export class QueryControlPointDto {
  @IsOptional()
  @IsEnum(CONTROL_POINT_STATUSES)
  status?: ControlPointStatus

  @IsOptional()
  @IsString()
  @Length(4, 20)
  @Matches(/^IT\d{2}$/)
  l1Code?: string

  @IsOptional()
  @IsString()
  @Length(7, 20)
  @Matches(/^IT\d{2}-\d{2}$/)
  l2Code?: string

  @IsOptional()
  @IsString()
  @Length(1, 100)
  controlFamily?: string

  @IsOptional()
  @IsString()
  @Length(1, 200)
  keyword?: string

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

export class CreateControlPointDto {
  @IsString()
  @Length(8, 100)
  @Matches(/^CTRL-[A-Z0-9-]+$/)
  controlCode: string

  @IsString()
  @Length(1, 300)
  controlName: string

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  controlDesc?: string | null

  @IsString()
  @Length(4, 20)
  @Matches(/^IT\d{2}$/)
  l1Code: string

  @IsString()
  @Length(7, 20)
  @Matches(/^IT\d{2}-\d{2}$/)
  l2Code: string

  @IsString()
  @Length(1, 100)
  controlFamily: string

  @IsEnum(CONTROL_POINT_TYPES)
  controlType: ControlPointType

  @IsBoolean()
  mandatoryDefault: boolean

  @IsEnum(CONTROL_POINT_RISK_LEVELS)
  riskLevelDefault: ControlPointRiskLevel

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  ownerRoleHint?: string[] | null

  @IsOptional()
  @IsEnum(CONTROL_POINT_STATUSES)
  status?: ControlPointStatus = 'ACTIVE'
}

export class UpdateControlPointDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(8, 100)
  @Matches(/^CTRL-[A-Z0-9-]+$/)
  controlCode?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 300)
  controlName?: string

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  controlDesc?: string | null

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(4, 20)
  @Matches(/^IT\d{2}$/)
  l1Code?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(7, 20)
  @Matches(/^IT\d{2}-\d{2}$/)
  l2Code?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 100)
  controlFamily?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(CONTROL_POINT_TYPES)
  controlType?: ControlPointType

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  mandatoryDefault?: boolean

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(CONTROL_POINT_RISK_LEVELS)
  riskLevelDefault?: ControlPointRiskLevel

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  ownerRoleHint?: string[] | null

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(CONTROL_POINT_STATUSES)
  status?: ControlPointStatus
}

export class UpdateControlPointStatusDto {
  @IsEnum(CONTROL_POINT_STATUSES)
  status: ControlPointStatus
}

export class ControlPointRouteParamsDto {
  @IsUUID()
  controlId: string
}
