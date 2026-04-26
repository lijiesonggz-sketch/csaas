import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'

export const KG_TAXONOMY_DOMAIN_ROLLOUT_STATES = [
  'legacy-primary',
  'it04-on-new-interface',
  'domain-shadow',
  'domain-compare',
  'domain-primary',
  'legacy-off',
] as const

export type KgTaxonomyDomainRolloutState =
  (typeof KG_TAXONOMY_DOMAIN_ROLLOUT_STATES)[number]

export type KgTaxonomyDomainRolloutThresholds = Record<string, unknown>

export type KgTaxonomyDomainRetirementEvidence = {
  lastCutoverAt?: string | null
  lastCutoverReleaseId?: string | null
  lastLegacyOffAt?: string | null
  lastLegacyOffReleaseId?: string | null
  lastKillSwitchDrillAt?: string | null
  lastRollbackVerifiedAt?: string | null
  lastReclassifyVerifiedAt?: string | null
  lastBackfillVerifiedAt?: string | null
  lastSmokeVerifiedAt?: string | null
  lastRetirementReportPath?: string | null
}

@Entity('kg_taxonomy_domain_rollout_policies')
@Unique('UQ_kg_taxonomy_domain_rollout_policies_l1_code', ['l1Code'])
@Index('idx_kg_taxonomy_domain_rollout_policies_state', ['rolloutState'])
@Index('idx_kg_taxonomy_domain_rollout_policies_kill_switch', ['killSwitchEnabled'])
export class KgTaxonomyDomainRolloutPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'l1_code', type: 'varchar', length: 20 })
  l1Code: string

  @Column({ name: 'rollout_state', type: 'varchar', length: 30 })
  rolloutState: KgTaxonomyDomainRolloutState

  @Column({ name: 'allow_legacy_fallback', type: 'boolean', default: true })
  allowLegacyFallback: boolean

  @Column({
    name: 'primary_threshold',
    type: 'numeric',
    precision: 5,
    scale: 4,
    default: 0.7,
  })
  primaryThreshold: string

  @Column({ name: 'shadow_window_days', type: 'int', default: 14 })
  shadowWindowDays: number

  @Column({ name: 'cutover_thresholds_json', type: 'jsonb', nullable: true })
  cutoverThresholdsJson: KgTaxonomyDomainRolloutThresholds | null

  @Column({
    name: 'retirement_thresholds_json',
    type: 'jsonb',
    nullable: true,
  })
  retirementThresholdsJson: KgTaxonomyDomainRolloutThresholds | null

  @Column({ name: 'kill_switch_enabled', type: 'boolean', default: false })
  killSwitchEnabled: boolean

  @Column({
    name: 'active_classifier_version',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  activeClassifierVersion: string | null

  @Column({ name: 'mapping_owner', type: 'varchar', length: 100, nullable: true })
  mappingOwner: string | null

  @Column({ name: 'rulebook_owner', type: 'varchar', length: 100, nullable: true })
  rulebookOwner: string | null

  @Column({
    name: 'benchmark_owner',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  benchmarkOwner: string | null

  @Column({ name: 'gate_approver', type: 'varchar', length: 100, nullable: true })
  gateApprover: string | null

  @Column({
    name: 'rollback_approver',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  rollbackApprover: string | null

  @Column({
    name: 'state_changed_at',
    type: 'timestamp',
    default: () => 'NOW()',
  })
  stateChangedAt: Date

  @Column({
    name: 'retirement_evidence_json',
    type: 'jsonb',
    nullable: true,
  })
  retirementEvidenceJson: KgTaxonomyDomainRetirementEvidence | null

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null
}
