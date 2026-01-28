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
 * Represents a technical topic/area that an organization wants to monitor
 * in the Radar Service. Users select topics during onboarding (AC 4) and
 * can modify them later.
 *
 * Examples: "云原生", "AI应用", "移动金融安全", "成本优化"
 *
 * @table watched_topics
 * @module backend/src/database/entities/watched-topic.entity
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
   * The technical topic name to monitor for trends and updates.
   * Can be selected from preset options or custom input by user.
   *
   * @example "云原生", "AI应用", "移动金融安全", "成本优化"
   */
  @Column({ type: 'varchar' })
  name: string

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
