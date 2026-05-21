import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TenantEntity } from '../interfaces/tenant-entity.interface'

export type AdvisoryOutputKnowledgeBaseAssociationStatus = 'associated' | 'pending' | 'failed'
export type AdvisoryOutputKnowledgeBaseAssociationMetadata = Record<
  string,
  string | number | boolean | null
>
export type AdvisoryOutputKnowledgeBaseAssociationAiMetadata = Record<string, unknown>

export const ADVISORY_OUTPUT_KB_ASSOCIATION_STATUSES = ['associated', 'pending', 'failed'] as const

@Entity('output_knowledge_base_associations')
@Check('CHK_output_kb_associations_status', `"status" IN ('associated', 'pending', 'failed')`)
@Index('idx_output_kb_associations_tenant_status', ['tenantId', 'status'])
@Index('idx_output_kb_associations_tenant_output', ['tenantId', 'outputId'])
@Index('idx_output_kb_associations_tenant_actor', ['tenantId', 'actorId'])
@Index('idx_output_kb_associations_tenant_updated', ['tenantId', 'updatedAt'])
@Index(
  'idx_output_kb_associations_one_per_output_destination',
  ['tenantId', 'outputId', 'destinationKey'],
  { unique: true },
)
export class AdvisoryOutputKnowledgeBaseAssociation implements TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string

  @Column({ name: 'output_id', type: 'uuid' })
  outputId: string

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string

  @Column({ name: 'destination_key', type: 'varchar', length: 128 })
  destinationKey: string

  @Column({ name: 'status', type: 'varchar', length: 32 })
  status: AdvisoryOutputKnowledgeBaseAssociationStatus

  @Column({ name: 'title', type: 'varchar', length: 500 })
  title: string

  @Column({ name: 'summary', type: 'text' })
  summary: string

  @Column({ name: 'source_workflow', type: 'varchar', length: 120 })
  sourceWorkflow: string

  @Column({ name: 'file_path', type: 'text' })
  filePath: string

  @Column({ name: 'ai_metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  aiMetadata: AdvisoryOutputKnowledgeBaseAssociationAiMetadata

  @Column({ name: 'external_reference_id', type: 'varchar', length: 255, nullable: true })
  externalReferenceId: string | null

  @Column({ name: 'message', type: 'text', nullable: true })
  message: string | null

  @Column({ name: 'last_attempt_at', type: 'timestamptz', nullable: true })
  lastAttemptAt: Date | null

  @Column({ name: 'associated_at', type: 'timestamptz', nullable: true })
  associatedAt: Date | null

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount: number

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: AdvisoryOutputKnowledgeBaseAssociationMetadata

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
