import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, Matches } from 'class-validator'
import type {
  KgTaxonomyDomainRolloutState,
  KgTaxonomyDomainRolloutThresholds,
} from '../../../database/entities/kg-taxonomy-domain-rollout-policy.entity'
import type { DomainRetirementEvidence } from '../services/taxonomy-classification/domain-rollout-policy.service'
import type {
  TaxonomyBenchmarkGateResult,
  TaxonomyDomainRuntimeMetrics,
} from '../services/taxonomy-domain-gate.service'

export const TAXONOMY_ROLLOUT_MUTABLE_TARGET_STATES = [
  'domain-shadow',
  'domain-compare',
  'domain-primary',
] as const

export type TaxonomyRolloutMutableTargetState =
  (typeof TAXONOMY_ROLLOUT_MUTABLE_TARGET_STATES)[number]

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

export class EvaluateTaxonomyRolloutGateDto {
  @ApiProperty({ example: 'IT07' })
  @IsString()
  @Matches(/^IT\d{2}$/)
  l1Code: string

  @ApiProperty({ enum: TAXONOMY_ROLLOUT_MUTABLE_TARGET_STATES, example: 'domain-compare' })
  @IsString()
  @IsIn(TAXONOMY_ROLLOUT_MUTABLE_TARGET_STATES)
  targetState: TaxonomyRolloutMutableTargetState
}

export class TransitionTaxonomyRolloutStateDto extends EvaluateTaxonomyRolloutGateDto {
  @ApiPropertyOptional({ example: 'rel-8-2-001' })
  @IsOptional()
  @IsString()
  releaseId?: string | null
}

export class TaxonomyRolloutPolicySummaryDto {
  @ApiProperty({ example: 'IT07' })
  l1Code: string

  @ApiProperty({ example: 'domain-compare' })
  rolloutState: KgTaxonomyDomainRolloutState

  @ApiProperty({ example: true })
  allowLegacyFallback: boolean

  @ApiProperty({ example: false })
  killSwitchEnabled: boolean

  @ApiProperty({ example: 'taxonomy-classifier-6.4' })
  activeClassifierVersion: string | null

  @ApiProperty({ example: 0.78 })
  primaryThreshold: number

  @ApiProperty({ example: 14 })
  shadowWindowDays: number

  @ApiProperty({ example: '2026-05-01T00:00:00.000Z' })
  stateChangedAt: Date | null
}

export class TaxonomyRolloutBenchmarkGateDto {
  @ApiProperty({ enum: ['PASS', 'FAIL'], example: 'PASS' })
  gateStatus: 'PASS' | 'FAIL'

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metrics?: TaxonomyBenchmarkGateResult['metrics']

  @ApiPropertyOptional({ example: 'tier-1-cutover' })
  sourceTier?: string | null

  @ApiPropertyOptional({ example: 'dual-path-compare' })
  sourceMode?: string | null
}

export class TaxonomyRolloutGateGuidanceDto {
  @ApiProperty({ example: 10 })
  canaryPercentage: number

  @ApiProperty({ example: 0.02 })
  errorBudget: number

  @ApiProperty({ example: 'Enable kill switch and revert rollout state' })
  rollbackPath: string
}

export class TaxonomyRolloutGateDecisionDto {
  @ApiProperty({ example: 'IT07' })
  l1Code: string

  @ApiProperty({ example: 'domain-shadow' })
  currentState: KgTaxonomyDomainRolloutState

  @ApiProperty({ example: 'domain-compare' })
  targetState: TaxonomyRolloutMutableTargetState

  @ApiProperty({ example: true })
  allowed: boolean

  @ApiProperty({ enum: ['PASS', 'FAIL'], example: 'PASS' })
  gateStatus: 'PASS' | 'FAIL'

  @ApiProperty({ type: [String] })
  blockingReasons: string[]

  @ApiProperty({ type: TaxonomyRolloutBenchmarkGateDto })
  benchmarkGate: TaxonomyRolloutBenchmarkGateDto

  @ApiProperty({ type: 'object', additionalProperties: true })
  metrics: TaxonomyDomainRuntimeMetrics

  @ApiProperty({ type: TaxonomyRolloutGateGuidanceDto })
  rolloutGuidance: TaxonomyRolloutGateGuidanceDto

  @ApiProperty({
    example:
      'Promote IT07 to domain-compare and keep monitoring rollback path Enable kill switch and revert rollout state.',
  })
  recommendedNextAction: string

  @ApiProperty({ type: TaxonomyRolloutPolicySummaryDto })
  policySummary: TaxonomyRolloutPolicySummaryDto
}

export class TaxonomyRolloutTransitionAuditDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000111' })
  updatedBy: string | null

  @ApiPropertyOptional({ example: 'rel-8-2-001' })
  releaseId?: string | null

  @ApiProperty({ example: 'Enable kill switch and revert rollout state' })
  rollbackPath: string
}

export class TaxonomyRolloutTransitionResultDto {
  @ApiProperty({ example: 'IT07' })
  l1Code: string

  @ApiProperty({ example: 'domain-shadow' })
  previousState: KgTaxonomyDomainRolloutState

  @ApiProperty({ example: 'domain-compare' })
  targetState: TaxonomyRolloutMutableTargetState

  @ApiProperty({ example: '2026-05-02T08:20:00.000Z' })
  stateChangedAt: Date | null

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000111' })
  operator: string | null

  @ApiProperty({ type: TaxonomyRolloutTransitionAuditDto })
  auditSummary: TaxonomyRolloutTransitionAuditDto

  @ApiProperty({ type: TaxonomyRolloutPolicySummaryDto })
  policySummary: TaxonomyRolloutPolicySummaryDto
}
