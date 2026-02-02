import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'

import { Organization } from './organization.entity'

/**
 * Tenant Entity
 *
 * Represents a consulting company (tenant) in the multi-tenant system.
 * Each tenant can have multiple organizations (clients).
 * This is the top-level entity for data isolation.
 *
 * @table tenants
 * @module backend/src/database/entities/tenant.entity
 */
@Entity('tenants')
export class Tenant {
  /**
   * Primary key - UUID v4
   */
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * Consulting company name
   *
   * Example: "Default Consulting Firm", "ABC Consulting", "XYZ Advisory"
   */
  @Column({ type: 'varchar', length: 255 })
  name: string

  /**
   * Subscription tier
   *
   * Determines the features and limits available to this tenant.
   *
   * @default 'basic'
   */
  @Column({ name: 'subscription_tier', type: 'varchar', length: 50, default: 'basic' })
  subscriptionTier: 'basic' | 'pro'

  /**
   * Brand configuration for white-label output
   *
   * Stores customization settings for this tenant's branding.
   * Used in Story 6.3 for white-label output functionality.
   *
   * @optional
   */
  @Column({ name: 'brand_config', type: 'jsonb', nullable: true })
  brandConfig?: {
    logo?: string
    companyName?: string
    themeColor?: string
  }

  /**
   * Active status
   *
   * Indicates whether this tenant is currently active.
   * Inactive tenants cannot access the system.
   *
   * @default true
   */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean

  /**
   * Timestamp when tenant was created
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  /**
   * Timestamp when tenant was last updated
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  /**
   * Organizations (clients) belonging to this tenant
   *
   * One tenant can have many organizations (clients)
   */
  @OneToMany(() => Organization, (org) => org.tenant)
  organizations: Organization[]
}
