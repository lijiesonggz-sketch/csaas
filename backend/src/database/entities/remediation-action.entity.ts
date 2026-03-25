import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import { ControlPoint } from './control-point.entity'

export const REMEDIATION_ACTION_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const
export type RemediationActionPriority = (typeof REMEDIATION_ACTION_PRIORITIES)[number]

export const REMEDIATION_ACTION_EFFORT_LEVELS = ['low', 'medium', 'high'] as const
export type RemediationActionEffortLevel = (typeof REMEDIATION_ACTION_EFFORT_LEVELS)[number]

export const REMEDIATION_ACTION_BENEFIT_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const
export type RemediationActionBenefitLevel = (typeof REMEDIATION_ACTION_BENEFIT_LEVELS)[number]

export const REMEDIATION_ACTION_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type RemediationActionStatus = (typeof REMEDIATION_ACTION_STATUSES)[number]

@Entity('remediation_actions')
@Unique('UQ_remediation_actions_action_code', ['actionCode'])
export class RemediationAction {
  @PrimaryGeneratedColumn('uuid', { name: 'action_id' })
  actionId: string

  @Column({ name: 'action_code', type: 'varchar', length: 100 })
  actionCode: string

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string

  @Column({ name: 'action_title', type: 'varchar', length: 300 })
  actionTitle: string

  @Column({ name: 'action_desc', type: 'text', nullable: true })
  actionDesc: string | null

  @Column({ name: 'priority_default', type: 'varchar', length: 20, default: 'MEDIUM' })
  priorityDefault: RemediationActionPriority

  @Column({ name: 'effort_level', type: 'varchar', length: 20, nullable: true })
  effortLevel: RemediationActionEffortLevel | null

  @Column({ name: 'expected_benefit', type: 'varchar', length: 20, nullable: true })
  expectedBenefit: RemediationActionBenefitLevel | null

  @Column({ name: 'owner_role_hint', type: 'jsonb', nullable: true })
  ownerRoleHint: string[] | null

  @Column({ name: 'output_template', type: 'jsonb', nullable: true })
  outputTemplate: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: RemediationActionStatus

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @ManyToOne(() => ControlPoint, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'control_id', referencedColumnName: 'controlId' })
  controlPoint: ControlPoint
}
