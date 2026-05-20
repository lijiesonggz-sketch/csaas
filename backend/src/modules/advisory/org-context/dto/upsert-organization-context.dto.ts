import { Transform } from 'class-transformer'
import { IsOptional, IsString, MaxLength } from 'class-validator'

export const ORGANIZATION_CONTEXT_NAME_MAX_LENGTH = 500
export const ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH = 200

export class UpsertOrganizationContextDto {
  @Transform(({ value }) => normalizeOrganizationContextText(value))
  @IsString()
  @MaxLength(ORGANIZATION_CONTEXT_NAME_MAX_LENGTH)
  organizationName: string

  @IsOptional()
  @Transform(({ value }) => normalizeOrganizationContextText(value))
  @IsString()
  @MaxLength(ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH)
  industry?: string

  @IsOptional()
  @Transform(({ value }) => normalizeOrganizationContextText(value))
  @IsString()
  @MaxLength(ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH)
  size?: string
}

function normalizeOrganizationContextText(value: unknown): unknown {
  return typeof value === 'string'
    ? value
        .replace(/\s+/g, ' ')
        .replace(/\p{C}+/gu, '')
        .trim()
    : value
}
