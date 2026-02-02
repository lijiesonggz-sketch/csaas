import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'

import { Organization } from './organization.entity'

/**
 * WatchedTopic Entity
 *
 * Represents a technical or industry topic/area that an organization wants to monitor
 * in the Radar Service. Users can configure watched topics to receive relevant pushes.
 *
 * Examples: "云原生", "AI应用", "移动金融安全", "成本优化"
 *
 * @table watched_topics
 * @module backend/src/database/entities/watched-topic.entity
 * @story Story 5.1 - Configure Focus Technical Areas
 */
@Entity('watched_topics')
export class WatchedTopic {
  /**
   * Primary key - UUID v4
   */
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * Topic name
   *
   * The technical or industry topic name to monitor for trends and updates.
   * Can be selected from preset options or custom input by user.
   *
   * @example "云原生", "AI应用", "移动金融安全", "成本优化"
   * @maxLength 100
   */
  @Column({ name: 'topic_name', type: 'varchar', length: 100 })
  topicName: string

  /**
   * Topic type - tech or industry
   *
   * Determines which radar system uses this topic:
   * - 'tech': Technical radar (Story 5.1)
   * - 'industry': Industry radar (Story 5.2)
   *
   * @default 'tech'
   */
  @Column({
    name: 'topic_type',
    type: 'enum',
    enum: ['tech', 'industry'],
    default: 'tech',
  })
  topicType: 'tech' | 'industry'

  /**
   * Optional description of the topic
   *
   * Helps users understand what this topic covers.
   *
   * @example "云原生技术包括容器化、微服务、Kubernetes等"
   * @maxLength 500
   * @optional
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string

  /**
   * Source of the watched topic
   *
   * Tracks how this topic was added:
   * - 'manual': User manually added this topic
   * - 'auto': System automatically added based on weakness analysis
   *
   * @default 'manual'
   * @optional
   */
  @Column({
    type: 'enum',
    enum: ['manual', 'auto'],
    default: 'manual',
    nullable: true,
  })
  source?: 'manual' | 'auto'

  /**
   * Organization that watches this topic
   *
   * Many watched topics can belong to one organization.
   */
  @ManyToOne(() => Organization, (org) => org.watchedTopics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization

  /**
   * Organization ID foreign key
   */
  @Column({ name: 'organization_id' })
  organizationId: string

  /**
   * 租户ID（咨询公司）
   *
   * 用于多租户数据隔离，确保咨询公司 A 的数据对咨询公司 B 不可见
   *
   * @story Story 6.1A - Multi-tenant API/Service Layer Isolation
   */
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string

  /**
   * Timestamp when topic was added
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  /**
   * Timestamp when topic was last updated
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  /**
   * Soft delete timestamp
   */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date
}
