import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TenantEntity } from '../interfaces/tenant-entity.interface'

export interface AdvisoryCheckpointCurrentStep {
  index: number
  label: string
  sourceRef?: string
}

export interface AdvisoryCheckpointConversationState {
  messageCount: number
  lastMessageId?: string
  historyPointer: string
}

export interface AdvisoryCheckpointDocumentState {
  outputId?: string
  status?: string
  title?: string
  summary?: string
  sectionCount: number
}

export interface AdvisoryCheckpointStateSnapshot {
  tenantId: string
  actorId: string
  sessionId: string
  workflowKey: string
  workflowType: string
  currentStep: AdvisoryCheckpointCurrentStep
  conversation: AdvisoryCheckpointConversationState
  documentState: AdvisoryCheckpointDocumentState
  lastActivityAt: string
  metadata?: Record<string, unknown>
}

export type AdvisoryWorkflowCheckpointMetadata = Record<string, unknown>

@Entity('workflow_checkpoints')
@Index('idx_workflow_checkpoints_tenant_id', ['tenantId'])
@Index('idx_workflow_checkpoints_session_id', ['sessionId'])
@Index('idx_workflow_checkpoints_tenant_session', ['tenantId', 'sessionId'])
@Index('idx_workflow_checkpoints_tenant_workflow', ['tenantId', 'workflowKey'])
@Index('idx_workflow_checkpoints_last_activity', ['tenantId', 'lastActivityAt'])
@Index('idx_workflow_checkpoints_tenant_session_sequence', ['tenantId', 'sessionId', 'sequence'], {
  unique: true,
})
export class AdvisoryWorkflowCheckpoint implements TenantEntity {
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

  @Column({ name: 'workflow_type', type: 'varchar', length: 200 })
  workflowType: string

  @Column({ name: 'step_index', type: 'integer' })
  stepIndex: number

  @Column({ name: 'sequence', type: 'integer' })
  sequence: number

  @Column({ name: 'checkpoint_type', type: 'varchar', length: 64 })
  checkpointType: string

  @Column({ name: 'current_step', type: 'jsonb' })
  currentStep: AdvisoryCheckpointCurrentStep

  @Column({ name: 'conversation_state', type: 'jsonb' })
  conversationState: AdvisoryCheckpointConversationState

  @Column({ name: 'document_state', type: 'jsonb' })
  documentState: AdvisoryCheckpointDocumentState

  @Column({ name: 'state_snapshot', type: 'jsonb' })
  stateSnapshot: AdvisoryCheckpointStateSnapshot

  @Column({ name: 'summary', type: 'text', default: '' })
  summary: string

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: AdvisoryWorkflowCheckpointMetadata

  @Column({ name: 'last_activity_at', type: 'timestamptz' })
  lastActivityAt: Date

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
