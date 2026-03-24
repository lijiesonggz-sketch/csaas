import { Type } from 'class-transformer'
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator'
import { TAXONOMY_STATUSES, TaxonomyStatus } from '../../../database/entities/taxonomy-l1.entity'

export class QueryTaxonomyTreeDto {
  @IsOptional()
  @IsEnum(TAXONOMY_STATUSES)
  status?: TaxonomyStatus = 'ACTIVE'

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
  @Length(1, 200)
  keyword?: string
}

export class CreateTaxonomyL1Dto {
  @IsString()
  @Length(4, 20)
  @Matches(/^IT\d{2}$/)
  l1Code: string

  @IsString()
  @Length(1, 200)
  l1Name: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number = 0

  @IsOptional()
  @IsEnum(TAXONOMY_STATUSES)
  status?: TaxonomyStatus = 'ACTIVE'
}

export class UpdateTaxonomyL1Dto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 200)
  l1Name?: string

  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(TAXONOMY_STATUSES)
  status?: TaxonomyStatus
}

export class CreateTaxonomyL2Dto {
  @IsString()
  @Length(7, 20)
  @Matches(/^IT\d{2}-\d{2}$/)
  l2Code: string

  @IsString()
  @Length(4, 20)
  @Matches(/^IT\d{2}$/)
  l1Code: string

  @IsString()
  @Length(1, 200)
  l2Name: string

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  l2Desc?: string | null

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number = 0

  @IsOptional()
  @IsEnum(TAXONOMY_STATUSES)
  status?: TaxonomyStatus = 'ACTIVE'
}

export class UpdateTaxonomyL2Dto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(4, 20)
  @Matches(/^IT\d{2}$/)
  l1Code?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 200)
  l2Name?: string

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  l2Desc?: string | null

  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(TAXONOMY_STATUSES)
  status?: TaxonomyStatus
}
