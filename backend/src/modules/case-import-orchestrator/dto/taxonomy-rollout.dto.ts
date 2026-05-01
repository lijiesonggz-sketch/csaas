import { ApiProperty } from '@nestjs/swagger'
import type {
  KgTaxonomyDomainRolloutState,
  KgTaxonomyDomainRolloutThresholds,
} from '../../../database/entities/kg-taxonomy-domain-rollout-policy.entity'
import type { DomainRetirementEvidence } from '../services/taxonomy-classification/domain-rollout-policy.service'

export class TaxonomyRolloutPolicyListItemDto {
  @ApiProperty({ example: 'policy-uuid-1' })
  id: string | null

  @ApiProperty({ example: 'IT04' })
  l1Code: string

  @ApiProperty({ example: 'it04-on-new-interface' })
  rolloutState: KgTaxonomyDomainRolloutState

  @ApiProperty({ example: true })
  allowLegacyFallback: boolean

  @ApiProperty({ example: false })
  killSwitchEnabled: boolean

  @ApiProperty({ example: 'v2.0' })
  activeClassifierVersion: string | null

  @ApiProperty({ example: 0.7 })
  primaryThreshold: number

  @ApiProperty({ example: 14 })
  shadowWindowDays: number

  @ApiProperty({ example: '2026-01-15T00:00:00.000Z' })
  stateChangedAt: Date | null

  @ApiProperty({ example: true })
  stateAllowsPrimary: boolean

  @ApiProperty({ example: true })
  stateAllowsLegacyFallback: boolean

  @ApiProperty({ example: false })
  hasRetirementEvidence: boolean
}

export class TaxonomyRolloutPolicyDetailDto extends TaxonomyRolloutPolicyListItemDto {
  @ApiProperty({ example: 'team-alpha' })
  mappingOwner: string

  @ApiProperty({ example: 'team-beta' })
  rulebookOwner: string

  @ApiProperty({ example: 'team-gamma' })
  benchmarkOwner: string

  @ApiProperty({ example: 'lead-1' })
  gateApprover: string

  @ApiProperty({ example: 'lead-2' })
  rollbackApprover: string

  @ApiProperty({ type: 'object', additionalProperties: true })
  cutoverThresholdsJson: KgTaxonomyDomainRolloutThresholds

  @ApiProperty({ type: 'object', additionalProperties: true })
  retirementThresholdsJson: KgTaxonomyDomainRolloutThresholds

  @ApiProperty({ type: 'object', additionalProperties: true })
  retirementEvidenceJson: DomainRetirementEvidence

  @ApiProperty({ example: '2026-01-15T00:00:00.000Z' })
  updatedAt: Date | null
}
