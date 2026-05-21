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

export type AdvisoryOutputRatingMetadata = Record<string, string | number | boolean | null>

@Entity('output_ratings')
@Check('CHK_output_ratings_rating_range', '"rating" IS NULL OR "rating" BETWEEN 1 AND 5')
@Index('idx_output_ratings_tenant_output', ['tenantId', 'outputId'])
@Index('idx_output_ratings_tenant_actor', ['tenantId', 'actorId'])
@Index('idx_output_ratings_tenant_created', ['tenantId', 'createdAt'])
@Index('idx_output_ratings_tenant_rating', ['tenantId', 'rating'])
@Index('idx_output_ratings_tenant_favorited', ['tenantId', 'isFavorited'])
@Index('idx_output_ratings_one_per_actor_output', ['tenantId', 'actorId', 'outputId'], {
  unique: true,
})
export class AdvisoryOutputRating implements TenantEntity {
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

  @Column({ name: 'rating', type: 'integer', nullable: true })
  rating: number | null

  @Column({ name: 'feedback_text', type: 'text', nullable: true })
  feedbackText: string | null

  @Column({ name: 'is_favorited', type: 'boolean', default: false })
  isFavorited: boolean

  @Column({ name: 'rated_at', type: 'timestamptz', nullable: true })
  ratedAt: Date | null

  @Column({ name: 'favorited_at', type: 'timestamptz', nullable: true })
  favoritedAt: Date | null

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: AdvisoryOutputRatingMetadata

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
