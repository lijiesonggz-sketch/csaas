import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TenantEntity } from '../interfaces/tenant-entity.interface'

export enum AdvisoryConversationMessageRole {
  User = 'user',
  Assistant = 'assistant',
}

export interface AdvisoryConversationDecisionOption {
  key: string
  action: 'continue' | 'deepen' | 'revise' | 'party-mode' | string
  label: string
  shortcut?: string
  enabled: boolean
  description?: string
}

export type AdvisoryConversationMessageMetadata = Record<string, string | number | boolean | null>
export type AdvisoryConversationProviderMetadata = Record<string, string | number | boolean | null>

@Entity('conversation_messages')
@Index('idx_conversation_messages_tenant_id', ['tenantId'])
@Index('idx_conversation_messages_session_id', ['sessionId'])
@Index('idx_conversation_messages_tenant_session_sequence', ['tenantId', 'sessionId', 'sequence'])
@Index('idx_conversation_messages_tenant_session_created', ['tenantId', 'sessionId', 'createdAt'])
@Index('idx_conversation_messages_workflow_step', ['tenantId', 'workflowKey', 'stepIndex'])
export class AdvisoryConversationMessage implements TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string

  @Column({ name: 'role', type: 'varchar', length: 32 })
  role: AdvisoryConversationMessageRole

  @Column({ name: 'content', type: 'text' })
  content: string

  @Column({ name: 'sequence', type: 'integer' })
  sequence: number

  @Column({ name: 'workflow_key', type: 'varchar', length: 100 })
  workflowKey: string

  @Column({ name: 'step_index', type: 'integer' })
  stepIndex: number

  @Column({ name: 'decision_options', type: 'jsonb', default: () => "'[]'::jsonb" })
  decisionOptions: AdvisoryConversationDecisionOption[]

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: AdvisoryConversationMessageMetadata

  @Column({ name: 'provider_metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  providerMetadata: AdvisoryConversationProviderMetadata

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
