import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator'
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

export const TAXONOMY_ROLLOUT_RETIREMENT_ROLLBACK_TARGET_STATES = ['domain-primary'] as const

export type TaxonomyRolloutRetirementRollbackTargetState =
  (typeof TAXONOMY_ROLLOUT_RETIREMENT_ROLLBACK_TARGET_STATES)[number]

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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{1,80}$/, {
    message:
      'releaseId must be 1-80 characters and contain only letters, numbers, dots, underscores, or hyphens.',
  })
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

export class TaxonomyRolloutRetirementPrerequisitesDto {
  @ApiProperty({ example: true })
  cutoverTierPassed: boolean

  @ApiProperty({ example: true })
  observationWindowPassed: boolean

  @ApiProperty({ example: true })
  killSwitchDrillPassed: boolean

  @ApiProperty({ example: true })
  rollbackVerified: boolean

  @ApiProperty({ example: true })
  reclassifyReady: boolean

  @ApiProperty({ example: true })
  backfillReady: boolean
}

export class TaxonomyRolloutPhysicalCleanupDecisionDto {
  @ApiProperty({ example: false })
  allowed: boolean

  @ApiProperty({ type: [String] })
  blockingReasons: string[]
}

export class TaxonomyRolloutRetirementLatestExecutionDto {
  @ApiPropertyOptional({ example: '2026-05-02T08:20:00.000Z' })
  lastLegacyOffAt?: string | null

  @ApiPropertyOptional({ example: 'rel-8-3-001' })
  lastLegacyOffReleaseId?: string | null

  @ApiPropertyOptional({ example: '2026-05-02T08:25:00.000Z' })
  lastSmokeVerifiedAt?: string | null

  @ApiPropertyOptional({ example: '2026-05-02T08:30:00.000Z' })
  lastRollbackVerifiedAt?: string | null

  @ApiPropertyOptional({ example: '/reports/taxonomy-retirement/IT04-rel-8-3-001.json' })
  lastRetirementReportPath?: string | null
}

export class EvaluateTaxonomyRolloutRetirementDto {
  @ApiProperty({ example: 'IT04' })
  @IsString()
  @Matches(/^IT\d{2}$/)
  l1Code: string
}

export class ExecuteTaxonomyRolloutRetirementDto extends EvaluateTaxonomyRolloutRetirementDto {
  @ApiProperty({ example: 'rel-8-3-001' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9._-]{1,80}$/, {
    message:
      'releaseId must be 1-80 characters and contain only letters, numbers, dots, underscores, or hyphens.',
  })
  releaseId: string

  @ApiProperty({ example: 'IT04' })
  @IsString()
  @Matches(/^IT\d{2}$/)
  confirmationText: string
}

export class RollbackTaxonomyRolloutRetirementDto extends EvaluateTaxonomyRolloutRetirementDto {
  @ApiPropertyOptional({
    enum: TAXONOMY_ROLLOUT_RETIREMENT_ROLLBACK_TARGET_STATES,
    example: 'domain-primary',
  })
  @IsOptional()
  @IsString()
  @IsIn(TAXONOMY_ROLLOUT_RETIREMENT_ROLLBACK_TARGET_STATES)
  targetState?: TaxonomyRolloutRetirementRollbackTargetState

  @ApiProperty({ example: 'IT04' })
  @IsString()
  @Matches(/^IT\d{2}$/)
  confirmationText: string

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  restoreLegacyFallback?: boolean
}

export class TaxonomyRolloutRetirementDryRunDecisionDto {
  @ApiProperty({ example: 'IT04' })
  l1Code: string

  @ApiProperty({ example: 'domain-primary' })
  currentState: KgTaxonomyDomainRolloutState

  @ApiProperty({ example: 'legacy-off' })
  targetState: 'legacy-off'

  @ApiProperty({ example: true })
  allowed: boolean

  @ApiProperty({ enum: ['PASS', 'FAIL'], example: 'PASS' })
  gateStatus: 'PASS' | 'FAIL'

  @ApiProperty({ type: TaxonomyRolloutRetirementPrerequisitesDto })
  prerequisites: TaxonomyRolloutRetirementPrerequisitesDto

  @ApiProperty({ type: [String] })
  blockingReasons: string[]

  @ApiProperty({ type: 'object', additionalProperties: true })
  metrics: TaxonomyDomainRuntimeMetrics

  @ApiProperty({ type: TaxonomyRolloutGateGuidanceDto })
  rolloutGuidance: TaxonomyRolloutGateGuidanceDto

  @ApiProperty({ example: 'Execute legacy-off for IT04.' })
  recommendedNextAction: string

  @ApiProperty({ type: TaxonomyRolloutPhysicalCleanupDecisionDto })
  cleanupReadiness: TaxonomyRolloutPhysicalCleanupDecisionDto

  @ApiProperty({ type: TaxonomyRolloutRetirementLatestExecutionDto })
  latestExecution: TaxonomyRolloutRetirementLatestExecutionDto

  @ApiProperty({ type: TaxonomyRolloutPolicySummaryDto })
  policySummary: TaxonomyRolloutPolicySummaryDto
}

export class TaxonomyRolloutSmokeVerificationDto {
  @ApiProperty({ example: true })
  passed: boolean

  @ApiPropertyOptional({ example: '2026-05-03T02:10:15.000Z' })
  checkedAt: string | null

  @ApiPropertyOptional({ example: 'smoke-check-unavailable: connection refused' })
  reason?: string
}

export class TaxonomyRolloutRollbackReadinessDto {
  @ApiProperty({ example: true })
  verified: boolean

  @ApiProperty({ example: 'Enable kill switch and revert rollout state to domain-primary' })
  path: string
}

export class TaxonomyRolloutRetirementExecutionAuditDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000111' })
  updatedBy: string | null

  @ApiProperty({ example: 'rel-8-3-001' })
  releaseId: string

  @ApiProperty({ example: 'Enable kill switch and revert rollout state to domain-primary' })
  rollbackPath: string
}

export class TaxonomyRolloutRetirementExecutionResultDto {
  @ApiProperty({ example: 'IT04' })
  l1Code: string

  @ApiProperty({ example: 'domain-primary' })
  previousState: KgTaxonomyDomainRolloutState

  @ApiProperty({ example: 'legacy-off' })
  targetState: 'legacy-off'

  @ApiProperty({ example: '2026-05-03T02:10:00.000Z' })
  stateChangedAt: Date | null

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000111' })
  operator: string | null

  @ApiProperty({ type: TaxonomyRolloutSmokeVerificationDto })
  smokeVerification: TaxonomyRolloutSmokeVerificationDto

  @ApiPropertyOptional({ example: '/reports/taxonomy-retirement/IT04-rel-8-3-001.json' })
  reportPath: string | null

  @ApiProperty({ example: 0.0087 })
  finalFallbackRate: number

  @ApiProperty({ type: TaxonomyRolloutPhysicalCleanupDecisionDto })
  cleanupReadiness: TaxonomyRolloutPhysicalCleanupDecisionDto

  @ApiProperty({ type: TaxonomyRolloutRollbackReadinessDto })
  rollbackReadiness: TaxonomyRolloutRollbackReadinessDto

  @ApiProperty({ type: TaxonomyRolloutRetirementExecutionAuditDto })
  auditSummary: TaxonomyRolloutRetirementExecutionAuditDto

  @ApiProperty({ type: TaxonomyRolloutPolicySummaryDto })
  policySummary: TaxonomyRolloutPolicySummaryDto
}

export class TaxonomyRolloutRetirementRollbackEvidenceDto {
  @ApiPropertyOptional({ example: '2026-05-03T02:20:00.000Z' })
  lastRollbackVerifiedAt: string | null

  @ApiPropertyOptional({ example: '/reports/taxonomy-retirement/IT04-rel-8-3-001.json' })
  lastRetirementReportPath: string | null
}

export class TaxonomyRolloutRetirementRollbackAuditDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000111' })
  updatedBy: string | null

  @ApiProperty({ example: 'Enable kill switch and revert rollout state to domain-primary' })
  rollbackPath: string
}

export class TaxonomyRolloutRetirementRollbackResultDto {
  @ApiProperty({ example: 'IT04' })
  l1Code: string

  @ApiProperty({ example: 'legacy-off' })
  previousState: KgTaxonomyDomainRolloutState

  @ApiProperty({ example: 'domain-primary' })
  targetState: TaxonomyRolloutRetirementRollbackTargetState

  @ApiProperty({ example: '2026-05-03T02:20:00.000Z' })
  stateChangedAt: Date | null

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000111' })
  operator: string | null

  @ApiProperty({ example: true })
  legacyFallbackRestored: boolean

  @ApiProperty({ example: 'Enable kill switch and revert rollout state to domain-primary' })
  rollbackPath: string

  @ApiPropertyOptional({ example: '/reports/taxonomy-retirement/IT04-rel-8-3-001.json' })
  reportPath: string | null

  @ApiProperty({ type: TaxonomyRolloutRetirementRollbackEvidenceDto })
  evidenceSummary: TaxonomyRolloutRetirementRollbackEvidenceDto

  @ApiProperty({ type: TaxonomyRolloutRetirementRollbackAuditDto })
  auditSummary: TaxonomyRolloutRetirementRollbackAuditDto

  @ApiProperty({ type: TaxonomyRolloutPolicySummaryDto })
  policySummary: TaxonomyRolloutPolicySummaryDto
}

export class ReclassifyTaxonomyRolloutRecoveryDto {
  @ApiProperty({ example: 'IT04' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  @IsString()
  l1Code?: string

  @ApiPropertyOptional({ example: 'batch-it04-2026-05-05' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  batchId?: string | null

  @ApiPropertyOptional({ type: [String], example: ['case-it04-001', 'case-it04-002'] })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter((item) => item !== '')
      : value,
  )
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  caseIds?: string[]

  @ApiPropertyOptional({ example: 'taxonomy-classifier-8.4' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  classifierVersion?: string | null

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  shadowOnly?: boolean

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  forceLatestPointer?: boolean

  @ApiPropertyOptional({ example: 'IT04' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  @IsString()
  confirmationText?: string | null
}

export class BackfillTaxonomyRolloutRecoveryDto {
  @ApiProperty({ example: 'IT04' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  @IsString()
  l1Code?: string

  @ApiPropertyOptional({ example: 'batch-it04-2026-05-05' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  batchId?: string | null

  @ApiPropertyOptional({ type: [String], example: ['case-it04-001', 'case-it04-002'] })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter((item) => item !== '')
      : value,
  )
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  caseIds?: string[]

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean

  @ApiPropertyOptional({ example: 'taxonomy-classifier-8.4' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  classifierVersion?: string | null

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  shadowOnly?: boolean

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  includeRetirementReadiness?: boolean

  @ApiPropertyOptional({ example: 'IT04' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  @IsString()
  confirmationText?: string | null
}

export class TaxonomyRolloutRecoveryScopeDto {
  @ApiPropertyOptional({ example: 'batch-it04-2026-05-05' })
  batchId: string | null

  @ApiProperty({ type: [String] })
  caseIds: string[]

  @ApiProperty({ example: 'IT04' })
  l1Code: string

  @ApiPropertyOptional({ example: true })
  shadowOnly?: boolean

  @ApiPropertyOptional({ example: false })
  forceLatestPointer?: boolean
}

export class TaxonomyRolloutRecoveryAuditSummaryDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000111', nullable: true })
  updatedBy: string | null

  @ApiProperty({ enum: ['success', 'blocked', 'failed'], example: 'success' })
  outcome: 'success' | 'blocked' | 'failed'

  @ApiPropertyOptional({ example: 'audit-log-id-001', nullable: true })
  auditId?: string | null
}

export class TaxonomyRolloutBackfillSummaryDto {
  @ApiProperty({ example: 4 })
  requestedCount: number

  @ApiProperty({ example: 3 })
  resetCount: number

  @ApiProperty({ example: 1 })
  skippedReviewedCount: number

  @ApiProperty({ example: 0 })
  skippedMissingBatchCount: number

  @ApiProperty({ example: 0 })
  extractedCount: number

  @ApiProperty({ example: 0 })
  clusteredCount: number

  @ApiProperty({ example: true })
  rollbackCompatible: boolean

  @ApiProperty({ example: false })
  requiresLegacyCodeRestore: boolean

  @ApiProperty({ type: [String] })
  batchIds: string[]
}

export class TaxonomyRolloutRecoveryOperationResultDto {
  @ApiProperty({ enum: ['reclassify', 'backfill'], example: 'reclassify' })
  operation: 'reclassify' | 'backfill'

  @ApiProperty({ example: 'IT04' })
  l1Code: string

  @ApiProperty({ example: true })
  dryRun: boolean

  @ApiPropertyOptional({ example: true })
  shadowOnly?: boolean

  @ApiProperty({ example: 12 })
  processedCount: number

  @ApiProperty({ type: [String], example: ['IT04'] })
  affectedDomains: string[]

  @ApiProperty({ example: false })
  latestPointerUpdated: boolean

  @ApiPropertyOptional({ example: 'taxonomy-classifier-8.4', nullable: true })
  classifierVersion: string | null

  @ApiProperty({ example: 'Dry-run reclassified 12 cases for IT04.' })
  summary: string

  @ApiPropertyOptional({
    example: '/reports/taxonomy-recovery/reclassify/IT04-20260505T040000000Z-dry-run.json',
    nullable: true,
  })
  reportPath: string | null

  @ApiProperty({ type: TaxonomyRolloutRecoveryScopeDto })
  scope: TaxonomyRolloutRecoveryScopeDto

  @ApiProperty({ type: TaxonomyRolloutRecoveryAuditSummaryDto })
  auditSummary: TaxonomyRolloutRecoveryAuditSummaryDto

  @ApiPropertyOptional({ type: TaxonomyRolloutBackfillSummaryDto })
  backfillSummary?: TaxonomyRolloutBackfillSummaryDto
}

export class TaxonomyRolloutReportHistoryQueryDto {
  @ApiPropertyOptional({ example: 'IT04' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  @IsString()
  @Matches(/^IT\d{2}$/)
  l1Code?: string

  @ApiPropertyOptional({ example: 1, default: 1 })
  @Transform(({ value }) => (value === undefined ? value : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 50 })
  @Transform(({ value }) => (value === undefined ? value : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @ApiPropertyOptional({ example: '2026-05-05T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  dateTo?: string
}

export class TaxonomyRolloutReportHistoryItemDto {
  @ApiProperty({ example: 'audit-reclassify-001' })
  id: string

  @ApiProperty({
    enum: ['retirement', 'rollback', 'reclassify', 'backfill', 'smoke', 'evidence'],
    example: 'reclassify',
  })
  type: 'retirement' | 'rollback' | 'reclassify' | 'backfill' | 'smoke' | 'evidence'

  @ApiProperty({ example: 'IT04' })
  l1Code: string

  @ApiProperty({ example: '2026-05-04T09:15:00.000Z' })
  occurredAt: string

  @ApiProperty({ example: 'completed' })
  status: string

  @ApiProperty({ example: 'success' })
  outcome: string

  @ApiProperty({ example: 'Reclassified 12 cases for IT04.' })
  summary: string

  @ApiPropertyOptional({
    example: '/reports/taxonomy-recovery/reclassify/IT04-20260504.json',
    nullable: true,
  })
  reportPath?: string | null

  @ApiPropertyOptional({
    example: '/reports/taxonomy-retirement/IT04-smoke.json',
    nullable: true,
  })
  evidenceLink?: string | null
}

export class TaxonomyRolloutReportHistoryResponseDto {
  @ApiProperty({ type: [TaxonomyRolloutReportHistoryItemDto] })
  items: TaxonomyRolloutReportHistoryItemDto[]

  @ApiProperty({ example: 1 })
  page: number

  @ApiProperty({ example: 20 })
  limit: number

  @ApiProperty({ example: 118 })
  total: number

  @ApiProperty({ example: true })
  hasNextPage: boolean
}
