import { Type } from 'class-transformer'
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator'
import {
  CONTROL_PACK_ITEM_ROLES,
  ControlPackItemRole,
} from '../../../database/entities/control-pack-item.entity'

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

export class QueryControlPackItemDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  packId?: string

  @IsOptional()
  @IsUUID()
  controlId?: string

  @IsOptional()
  @IsEnum(CONTROL_PACK_ITEM_ROLES)
  itemRole?: ControlPackItemRole
}

export class CreateControlPackItemDto {
  @IsUUID()
  packId: string

  @IsUUID()
  controlId: string

  @IsOptional()
  @IsEnum(CONTROL_PACK_ITEM_ROLES)
  itemRole?: ControlPackItemRole = 'INCLUDE'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number = 100
}

export class UpdateControlPackItemDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  packId?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  controlId?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(CONTROL_PACK_ITEM_ROLES)
  itemRole?: ControlPackItemRole

  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number
}

export class QueryControlApplicabilityContextDto {
  @IsUUID()
  organizationId: string
}
