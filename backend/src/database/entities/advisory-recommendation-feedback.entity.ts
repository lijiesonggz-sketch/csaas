import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TenantEntity } from '../interfaces/tenant-entity.interface'

export type AdvisoryRecommendationFeedbackMetadata = Record<
  string,
  string | number | boolean | null | string[]
>

@Entity('recommendation_feedback')
@Index('idx_recommendation_feedback_tenant_id', ['tenantId'])
@Index('idx_recommendation_feedback_actor_id', ['actorId'])
@Index('idx_recommendation_feedback_context_id', ['quickConsultContextId'])
@Index('idx_recommendation_feedback_tenant_created', ['tenantId', 'createdAt'])
@Index('idx_recommendation_feedback_tenant_rating', ['tenantId', 'rating'])
@Index('idx_recommendation_feedback_tenant_problem_type', ['tenantId', 'primaryProblemType'])
@Index(
  'idx_recommendation_feedback_one_per_actor_context',
  ['tenantId', 'actorId', 'quickConsultContextId'],
  { unique: true },
)
export class AdvisoryRecommendationFeedback implements TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string

  @Column({ name: 'quick_consult_context_id', type: 'uuid' })
  quickConsultContextId: string

  @Column({ name: 'rating', type: 'integer' })
  rating: number

  @Column({ name: 'feedback_text', type: 'text', nullable: true })
  feedbackText: string | null

  @Column({ name: 'problem_type_ids', type: 'jsonb', default: () => "'[]'::jsonb" })
  problemTypeIds: string[]

  @Column({ name: 'primary_problem_type', type: 'varchar', length: 80, nullable: true })
  primaryProblemType: string | null

  @Column({ name: 'recommendation_ids', type: 'jsonb', default: () => "'[]'::jsonb" })
  recommendationIds: string[]

  @Column({ name: 'workflow_keys', type: 'jsonb', default: () => "'[]'::jsonb" })
  workflowKeys: string[]

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: AdvisoryRecommendationFeedbackMetadata

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
