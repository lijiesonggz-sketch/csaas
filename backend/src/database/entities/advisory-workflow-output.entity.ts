import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TenantEntity } from '../interfaces/tenant-entity.interface'

export enum AdvisoryWorkflowOutputStatus {
  Draft = 'draft',
  Completed = 'completed',
  Deleted = 'deleted',
}

export interface AdvisoryWorkflowOutputSection {
  id: string
  stepIndex: number
  heading: string
  contentMarkdown: string
  aiLabel: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type AdvisoryWorkflowOutputAiLabelMetadata = Record<string, unknown>
export type AdvisoryWorkflowOutputMetadata = Record<string, unknown>

@Entity('workflow_outputs')
@Index('idx_workflow_outputs_tenant_id', ['tenantId'])
@Index('idx_workflow_outputs_session_id', ['sessionId'])
@Index('idx_workflow_outputs_tenant_session', ['tenantId', 'sessionId'])
@Index('idx_workflow_outputs_tenant_workflow_status', ['tenantId', 'workflowKey', 'status'])
@Index('idx_workflow_outputs_tenant_created', ['tenantId', 'createdAt'])
@Index('idx_workflow_outputs_one_draft_session', ['tenantId', 'sessionId'], {
  unique: true,
  where: '"status" = \'draft\'',
})
export class AdvisoryWorkflowOutput implements TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string

  @Column({ name: 'workflow_key', type: 'varchar', length: 100 })
  workflowKey: string

  @Column({
    name: 'status',
    type: 'varchar',
    length: 32,
    default: AdvisoryWorkflowOutputStatus.Draft,
  })
  status: AdvisoryWorkflowOutputStatus

  @Column({ name: 'title', type: 'varchar', length: 240 })
  title: string

  @Column({ name: 'summary', type: 'text', default: '' })
  summary: string

  @Column({ name: 'content_markdown', type: 'text', default: '' })
  contentMarkdown: string

  @Column({ name: 'sections', type: 'jsonb', default: () => "'[]'::jsonb" })
  sections: AdvisoryWorkflowOutputSection[]

  @Column({ name: 'ai_label_metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  aiLabelMetadata: AdvisoryWorkflowOutputAiLabelMetadata

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: AdvisoryWorkflowOutputMetadata

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
