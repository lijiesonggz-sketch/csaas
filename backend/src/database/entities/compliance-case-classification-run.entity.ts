import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { ComplianceCase } from './compliance-case.entity'

export const COMPLIANCE_CASE_CLASSIFICATION_RUN_STATUSES = [
  'SUCCEEDED',
  'ABSTAINED',
  'FAILED',
  'FALLBACK_APPLIED',
] as const
export type ComplianceCaseClassificationRunStatus =
  (typeof COMPLIANCE_CASE_CLASSIFICATION_RUN_STATUSES)[number]

export const COMPLIANCE_CASE_CLASSIFICATION_RUN_FALLBACK_REASONS = [
  'LOW_CONFIDENCE',
  'NO_MATCH',
  'MAPPING_MISSING',
  'ENGINE_ERROR',
  'LEGACY_FALLBACK_TRIGGERED',
  'PENDING_RECLASSIFY',
] as const
export type ComplianceCaseClassificationRunFallbackReason =
  (typeof COMPLIANCE_CASE_CLASSIFICATION_RUN_FALLBACK_REASONS)[number]

export const COMPLIANCE_CASE_CLASSIFICATION_RUN_PATH_DECISIONS = [
  'PRIMARY_CHAIN',
  'LEGACY_FALLBACK',
  'ABSTAIN',
  'UNCLASSIFIED',
] as const
export type ComplianceCaseClassificationRunPathDecision =
  (typeof COMPLIANCE_CASE_CLASSIFICATION_RUN_PATH_DECISIONS)[number]

export const COMPLIANCE_CASE_CLASSIFICATION_RUN_DECISION_SOURCES = [
  'rule',
  'semantic',
  'hybrid',
  'none',
] as const
export type ComplianceCaseClassificationRunDecisionSource =
  (typeof COMPLIANCE_CASE_CLASSIFICATION_RUN_DECISION_SOURCES)[number]

@Entity('compliance_case_classification_runs')
@Index('idx_cccr_case_created', ['caseId', 'createdAt'])
@Index('idx_cccr_latest', ['caseId', 'isLatest'])
@Index('idx_cccr_path', ['pathDecision'])
@Index('idx_cccr_fallback_reason', ['fallbackReason'])
@Index('idx_cccr_versions', [
  'classifierVersion',
  'mappingVersion',
  'rulebookVersion',
])
@Index('idx_cccr_batch', ['batchId'])
export class ComplianceCaseClassificationRun {
  @PrimaryGeneratedColumn('uuid', { name: 'classification_run_id' })
  classificationRunId: string

  @Column({ name: 'case_id', type: 'uuid' })
  caseId: string

  @Column({ name: 'batch_id', type: 'varchar', length: 100, nullable: true })
  batchId: string | null

  @Column({ name: 'classifier_version', type: 'varchar', length: 50 })
  classifierVersion: string

  @Column({ name: 'mapping_version', type: 'varchar', length: 50 })
  mappingVersion: string

  @Column({ name: 'rulebook_version', type: 'varchar', length: 50 })
  rulebookVersion: string

  @Column({ name: 'input_hash', type: 'varchar', length: 128 })
  inputHash: string

  @Column({ name: 'normalized_input_json', type: 'jsonb', nullable: true })
  normalizedInputJson: Record<string, unknown> | null

  @Column({ name: 'matched_signals_json', type: 'jsonb', nullable: true })
  matchedSignalsJson: string[] | null

  @Column({ name: 'decision_trace_json', type: 'jsonb', nullable: true })
  decisionTraceJson: Record<string, unknown> | null

  @Column({ name: 'l1_code', type: 'varchar', length: 20, nullable: true })
  l1Code: string | null

  @Column({ name: 'l2_code', type: 'varchar', length: 20, nullable: true })
  l2Code: string | null

  @Column({
    name: 'confidence_score',
    type: 'numeric',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  confidenceScore: string | null

  @Column({ name: 'decision_source', type: 'varchar', length: 30 })
  decisionSource: ComplianceCaseClassificationRunDecisionSource

  @Column({ name: 'path_decision', type: 'varchar', length: 30 })
  pathDecision: ComplianceCaseClassificationRunPathDecision

  @Column({ name: 'fallback_reason', type: 'varchar', length: 50, nullable: true })
  fallbackReason: ComplianceCaseClassificationRunFallbackReason | null

  @Column({ name: 'classification_status', type: 'varchar', length: 30 })
  classificationStatus: ComplianceCaseClassificationRunStatus

  @Column({ name: 'is_latest', type: 'boolean', default: false })
  isLatest: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @ManyToOne(() => ComplianceCase, {
    onDelete: 'RESTRICT',
    nullable: false,
  })
  @JoinColumn({ name: 'case_id', referencedColumnName: 'caseId' })
  caseRecord: ComplianceCase
}
