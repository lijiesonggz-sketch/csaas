import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TenantEntity } from '../interfaces/tenant-entity.interface'

export enum AdvisoryWorkflowSessionStatus {
  Active = 'active',
  LaunchFailed = 'launch_failed',
  Completed = 'completed',
}

export interface AdvisoryWorkflowSessionCurrentStep {
  index: number
  label: string
  sourceRef?: string
}

export type AdvisoryWorkflowSessionMetadata = Record<string, string | number | boolean | null>

@Entity('workflow_sessions')
@Index('idx_workflow_sessions_tenant_id', ['tenantId'])
@Index('idx_workflow_sessions_actor_id', ['actorId'])
@Index('idx_workflow_sessions_workflow_key', ['workflowKey'])
@Index('idx_workflow_sessions_status', ['status'])
@Index('idx_workflow_sessions_tenant_workflow_status', ['tenantId', 'workflowKey', 'status'])
@Index('idx_workflow_sessions_one_active_actor', ['tenantId', 'actorId'], {
  unique: true,
  where: '"status" = \'active\'',
})
export class AdvisoryWorkflowSession implements TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string

  @Column({ name: 'workflow_key', type: 'varchar', length: 100 })
  workflowKey: string

  @Column({ name: 'workflow_display_name', type: 'varchar', length: 200 })
  workflowDisplayName: string

  @Column({ name: 'scenario_label', type: 'varchar', length: 255 })
  scenarioLabel: string

  @Column({
    name: 'status',
    type: 'varchar',
    length: 32,
    default: AdvisoryWorkflowSessionStatus.Active,
  })
  status: AdvisoryWorkflowSessionStatus

  @Column({ name: 'current_step', type: 'jsonb' })
  currentStep: AdvisoryWorkflowSessionCurrentStep

  @Column({ name: 'source_refs', type: 'jsonb', default: () => "'[]'::jsonb" })
  sourceRefs: string[]

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: AdvisoryWorkflowSessionMetadata

  @Column({ name: 'failure_code', type: 'varchar', length: 120, nullable: true })
  failureCode: string | null

  @Column({ name: 'failure_message', type: 'text', nullable: true })
  failureMessage: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
