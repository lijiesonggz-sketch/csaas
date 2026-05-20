import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TenantEntity } from '../interfaces/tenant-entity.interface'

export enum AdvisoryQuickConsultContextStatus {
  ClarificationRequired = 'clarification_required',
  AnalysisPending = 'analysis_pending',
  AnalysisStarted = 'analysis_started',
  AnalysisFailed = 'analysis_failed',
}

export interface AdvisoryQuickConsultClarificationAnswer {
  question: string
  answer: string
}

export type AdvisoryQuickConsultContextMetadataValue =
  | string
  | number
  | boolean
  | null
  | AdvisoryQuickConsultContextMetadataValue[]
  | { [key: string]: AdvisoryQuickConsultContextMetadataValue }

export type AdvisoryQuickConsultContextMetadata = Record<
  string,
  AdvisoryQuickConsultContextMetadataValue
>

@Entity('quick_consult_contexts')
@Index('idx_quick_consult_contexts_tenant_id', ['tenantId'])
@Index('idx_quick_consult_contexts_actor_id', ['actorId'])
@Index('idx_quick_consult_contexts_status', ['status'])
@Index('idx_quick_consult_contexts_tenant_actor_created', ['tenantId', 'actorId', 'createdAt'])
export class AdvisoryQuickConsultContext implements TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string

  @Column({ name: 'original_problem', type: 'text' })
  originalProblem: string

  @Column({ name: 'normalized_problem', type: 'text', nullable: true })
  normalizedProblem: string | null

  @Column({
    name: 'status',
    type: 'varchar',
    length: 32,
    default: AdvisoryQuickConsultContextStatus.ClarificationRequired,
  })
  status: AdvisoryQuickConsultContextStatus

  @Column({ name: 'clarification_questions', type: 'jsonb', default: () => "'[]'::jsonb" })
  clarificationQuestions: string[]

  @Column({ name: 'clarification_answers', type: 'jsonb', default: () => "'[]'::jsonb" })
  clarificationAnswers: AdvisoryQuickConsultClarificationAnswer[]

  @Column({ name: 'provider', type: 'varchar', length: 80, nullable: true })
  provider: string | null

  @Column({ name: 'provider_status', type: 'varchar', length: 32, nullable: true })
  providerStatus: string | null

  @Column({ name: 'latency_ms', type: 'integer', default: 0 })
  latencyMs: number

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: AdvisoryQuickConsultContextMetadata

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
