import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'

export const APPLICABILITY_RULE_TARGET_TYPES = ['pack', 'control'] as const
export const APPLICABILITY_RULE_TYPES = ['include', 'exclude', 'strengthen', 'recommend'] as const

export type ApplicabilityRuleTargetType = (typeof APPLICABILITY_RULE_TARGET_TYPES)[number]
export type ApplicabilityRuleType = (typeof APPLICABILITY_RULE_TYPES)[number]

@Entity('applicability_rules')
@Unique('UQ_applicability_rules_rule_code', ['ruleCode'])
export class ApplicabilityRule {
  @PrimaryGeneratedColumn('uuid', { name: 'rule_id' })
  ruleId: string

  @Column({ name: 'rule_code', type: 'varchar', length: 100 })
  ruleCode: string

  @Column({ name: 'target_type', type: 'varchar', length: 30 })
  targetType: ApplicabilityRuleTargetType

  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string

  @Column({ name: 'rule_type', type: 'varchar', length: 20 })
  ruleType: ApplicabilityRuleType

  @Column({ name: 'predicate_json', type: 'jsonb' })
  predicateJson: Record<string, unknown>

  @Column({ name: 'result_json', type: 'jsonb', nullable: true })
  resultJson?: Record<string, unknown> | null

  @Column({ type: 'int', default: 100 })
  priority: number

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom?: string | null

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo?: string | null

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
