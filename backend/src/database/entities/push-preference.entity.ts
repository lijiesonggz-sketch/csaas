import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm'

import { Organization } from './organization.entity'

/**
 * PushPreference Entity
 *
 * Represents an organization's push notification preferences for Radar Service.
 * Each organization has exactly one push preference record.
 *
 * @table push_preferences
 * @module backend/src/database/entities/push-preference.entity
 */
@Entity('push_preferences')
export class PushPreference {
  /**
   * Primary key - UUID v4
   */
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * Tenant ID - foreign key to tenants table
   * Multi-tenant isolation
   */
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string

  /**
   * Organization ID - foreign key to organizations table
   * Each organization has exactly one push preference record
   */
  @Column({ name: 'organization_id', unique: true })
  organizationId: string

  /**
   * Push start time - when push notifications can begin
   * Format: "HH:mm" (24-hour format)
   * Default: "09:00" (9:00 AM)
   *
   * Example: "09:00", "22:00"
   */
  @Column({ name: 'push_start_time', type: 'time', default: '09:00:00' })
  pushStartTime: string

  /**
   * Push end time - when push notifications should stop
   * Format: "HH:mm" (24-hour format)
   * Default: "18:00" (6:00 PM)
   *
   * Example: "18:00", "08:00"
   * Note: Can be earlier than start time for overnight windows (e.g., 22:00-08:00)
   */
  @Column({ name: 'push_end_time', type: 'time', default: '18:00:00' })
  pushEndTime: string

  /**
   * Daily push limit - maximum number of pushes per day
   * Range: 1-20
   * Default: 5
   *
   * Used to prevent information overload
   */
  @Column({ name: 'daily_push_limit', type: 'int', default: 5 })
  dailyPushLimit: number

  /**
   * Relevance filter - minimum relevance level for pushes
   * Values:
   * - 'high_only': Only push content with relevanceScore >= 0.9
   * - 'high_medium': Push content with relevanceScore >= 0.7
   *
   * Default: 'high_only'
   */
  @Column({
    name: 'relevance_filter',
    type: 'varchar',
    length: 20,
    default: 'high_only',
  })
  relevanceFilter: 'high_only' | 'high_medium'

  /**
   * Timestamp when preference record was created
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  /**
   * Timestamp when preference record was last updated
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  /**
   * Organization associated with this preference
   * One-to-one relationship with cascade delete
   */
  @OneToOne(() => Organization, (org) => org.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization
}
