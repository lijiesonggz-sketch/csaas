import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator'
import {
  CONTROL_POINT_ORIGIN_TYPES,
  CONTROL_POINT_MATURITY_LEVELS,
  APPLICABLE_SECTORS,
  SECTOR_REQUIREMENT_KEYS,
  ControlPointOriginType,
  ControlPointMaturityLevel,
  ApplicableSector,
  AuthorityProfile,
  SectorRequirements,
} from '../../../database/entities/control-point.entity'

// ---------------------------------------------------------------------------
// Custom validator: authority_profile_json must have valid dimension keys with boolean values
// ---------------------------------------------------------------------------

const AUTHORITY_PROFILE_KEYS = [
  'has_source_basis',
  'has_applicability_scope',
  'has_control_activity',
  'has_expected_evidence',
  'has_human_review',
  'has_case_validation',
] as const

@ValidatorConstraint({ name: 'isAuthorityProfile', async: false })
export class IsAuthorityProfile implements ValidatorConstraintInterface {
  validate(value: unknown, _args: ValidationArguments): boolean {
    if (value === null || value === undefined) return true
    if (typeof value !== 'object' || Array.isArray(value)) return false
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    const validKeys = [...AUTHORITY_PROFILE_KEYS] as string[]
    // All keys must be valid dimension keys and all values must be boolean
    return keys.every((k) => validKeys.includes(k) && typeof obj[k] === 'boolean')
  }

  defaultMessage(_args: ValidationArguments): string {
    return `authority_profile_json keys must be from [${AUTHORITY_PROFILE_KEYS.join(', ')}] with boolean values`
  }
}

// ---------------------------------------------------------------------------
// Custom validator: sector_requirements keys must be in SECTOR_REQUIREMENT_KEYS
// ---------------------------------------------------------------------------

@ValidatorConstraint({ name: 'isSectorRequirementsKeys', async: false })
export class IsSectorRequirementsKeys implements ValidatorConstraintInterface {
  validate(value: unknown, _args: ValidationArguments): boolean {
    if (value === null || value === undefined) return true
    if (typeof value !== 'object' || Array.isArray(value)) return false
    const keys = Object.keys(value as Record<string, unknown>)
    const validKeys = [...SECTOR_REQUIREMENT_KEYS] as string[]
    return keys.every((k) => validKeys.includes(k))
  }

  defaultMessage(_args: ValidationArguments): string {
    return `sector_requirements keys must be one of: ${[...SECTOR_REQUIREMENT_KEYS].join(', ')}`
  }
}

// ---------------------------------------------------------------------------
// UpdateControlPointGovernanceDto
// ---------------------------------------------------------------------------

export class UpdateControlPointGovernanceDto {
  @IsOptional()
  @IsIn([...CONTROL_POINT_ORIGIN_TYPES])
  originType?: ControlPointOriginType

  @IsOptional()
  @IsIn([...CONTROL_POINT_MATURITY_LEVELS])
  maturityLevel?: ControlPointMaturityLevel

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  @ValidateIf((_o, v) => v !== null)
  objectiveSummary?: string | null

  @IsOptional()
  @IsObject()
  sourceBasis?: Record<string, unknown> | null

  @IsOptional()
  @IsObject()
  @Validate(IsAuthorityProfile)
  authorityProfileJson?: AuthorityProfile | null

  @IsOptional()
  @IsUUID()
  @ValidateIf((_o, v) => v !== null)
  supersededBy?: string | null

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  @ValidateIf((_o, v) => v !== null)
  retiredReason?: string | null

  @IsOptional()
  @IsArray()
  @IsIn([...APPLICABLE_SECTORS], { each: true })
  applicableSector?: ApplicableSector[]

  @IsOptional()
  @IsObject()
  @Validate(IsSectorRequirementsKeys)
  sectorRequirements?: SectorRequirements | null

  @IsOptional()
  @IsString()
  @Length(0, 300)
  @ValidateIf((_o, v) => v !== null)
  canonicalTheme?: string | null
}
