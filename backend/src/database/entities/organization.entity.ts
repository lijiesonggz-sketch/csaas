import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm'

import { OrganizationMember } from './organization-member.entity'
import { Project } from './project.entity'
import { WeaknessSnapshot } from './weakness-snapshot.entity'
import { WatchedTopic } from './watched-topic.entity'
import { WatchedPeer } from './watched-peer.entity'
import { Tenant } from './tenant.entity'
import { ClientGroupMembership } from './client-group-membership.entity'
import { OrganizationProfile } from './organization-profile.entity'

/**
 * Organization Entity
 *
 * Represents an organization (company/enterprise) in the Radar Service system.
 * Users belong to organizations, and projects are associated with organizations.
 * Radar Service operates at the organization level, not project level.
 *
 * @table organizations
 * @module backend/src/database/entities/organization.entity
 */
@Entity('organizations')
export class Organization {
  /**
   * Primary key - UUID v4
   */
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * Organization name
   *
   * Example: "用户的组织", "杭州银行组织", "默认组织"
   */
  @Column({ type: 'varchar' })
  name: string

  /**
   * Tenant ID (Consulting Company)
   *
   * Foreign key to the Tenant table. Represents which consulting company
   * this organization (client) belongs to. Used for multi-tenant data isolation.
   *
   * @required After migration completes, this field becomes NOT NULL
   */
  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  tenantId: string

  /**
   * Tenant relationship
   *
   * Many organizations belong to one tenant (consulting company)
   */
  @ManyToOne(() => Tenant, (tenant) => tenant.organizations)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant

  /**
   * Radar Service activation status
   *
   * Indicates whether the organization has completed the onboarding process
   * and activated Radar Service. Set to true after user completes the 3-step
   * onboarding wizard (weakness display, topic selection, peer selection).
   *
   * @default false
   */
  @Column({ name: 'radar_activated', type: 'boolean', default: false })
  radarActivated: boolean

  /**
   * Industry classification (optional)
   *
   * Indicates the industry sector this organization belongs to.
   * Used to provide industry-specific presets and recommendations.
   *
   * Supported values:
   * - banking: 银行业
   * - securities: 证券业
   * - insurance: 保险业
   * - enterprise: 传统企业
   *
   * @default null
   */
  @Column({ name: 'industry_type', type: 'varchar', length: 50, nullable: true })
  industryType?: string

  /**
   * Contact person name
   *
   * Primary contact person for this organization (client).
   * Used in consulting company client management.
   *
   * @story 6-2
   * @default null
   */
  @Column({ name: 'contact_person', type: 'varchar', length: 255, nullable: true })
  contactPerson?: string

  /**
   * Contact email address
   *
   * Primary contact email for this organization (client).
   * Used for sending welcome emails and notifications.
   *
   * @story 6-2
   * @default null
   */
  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail?: string

  /**
   * Organization scale/size
   *
   * Indicates the size category of this organization.
   *
   * Supported values:
   * - large: 大型机构
   * - medium: 中型机构
   * - small: 小型机构
   *
   * @story 6-2
   * @default null
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  scale?: 'large' | 'medium' | 'small'

  /**
   * Organization status
   *
   * Current status of this organization in the system.
   *
   * Supported values:
   * - active: 已激活
   * - inactive: 未激活
   * - trial: 试用期
   *
   * @story 6-2
   * @default 'trial'
   */
  @Column({ type: 'varchar', length: 50, default: 'trial' })
  status: 'active' | 'inactive' | 'trial'

  /**
   * Timestamp when organization was activated
   *
   * Set when status changes from trial/inactive to active.
   *
   * @story 6-2
   * @default null
   */
  @Column({ name: 'activated_at', type: 'timestamp', nullable: true })
  activatedAt?: Date

  /**
   * Timestamp when organization was created
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  /**
   * Timestamp when organization was last updated
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  /**
   * Soft delete timestamp
   * Organization is not actually deleted, just marked as deleted
   */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date

  /**
   * Organization members belonging to this organization
   *
   * One organization can have many members (users)
   */
  @OneToMany(() => OrganizationMember, (member) => member.organization, {
    onDelete: 'CASCADE',
  })
  members: OrganizationMember[]

  /**
   * Projects belonging to this organization
   *
   * One organization can have many projects
   */
  @OneToMany(() => Project, (project) => project.organization)
  projects: Project[]

  /**
   * Weakness snapshots for this organization
   *
   * Aggregated from all projects belonging to this organization
   */
  @OneToMany(() => WeaknessSnapshot, (weakness) => weakness.organization)
  weaknessSnapshots: WeaknessSnapshot[]

  /**
   * Technical topics watched by this organization
   *
   * Selected during onboarding for Radar Service monitoring
   */
  @OneToMany(() => WatchedTopic, (topic) => topic.organization, {
    onDelete: 'CASCADE',
  })
  watchedTopics: WatchedTopic[]

  /**
   * Peer institutions watched by this organization
   *
   * Selected during onboarding for benchmarking and learning
   */
  @OneToMany(() => WatchedPeer, (peer) => peer.organization, {
    onDelete: 'CASCADE',
  })
  watchedPeers: WatchedPeer[]

  /**
   * Knowledge Graph organization profile
   *
   * One-to-one extension table for applicability-engine inputs.
   * Kept separate from organizations to avoid bloating the core entity.
   */
  @OneToOne(() => OrganizationProfile, (profile) => profile.organization)
  profile?: OrganizationProfile

  /**
   * Client group memberships for this organization
   *
   * Links this organization to client groups for bulk management.
   *
   * @story 6-2
   */
  @OneToMany(() => ClientGroupMembership, (membership) => membership.organization, {
    onDelete: 'CASCADE',
  })
  groupMemberships: ClientGroupMembership[]

  /**
   * Timestamp when organization was last active
   *
   * Updated when any user activity is recorded (login, push view, feedback).
   *
   * @story 7-3
   * @default null
   */
  @Column({ name: 'last_active_at', type: 'timestamp', nullable: true })
  lastActiveAt?: Date

  /**
   * Monthly activity rate (MAU percentage)
   *
   * Calculated as: (active days in last 30 days / 30) * 100
   * Updated periodically by a background job.
   *
   * @story 7-3
   * @default null
   */
  @Column({ name: 'monthly_activity_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  monthlyActivityRate?: number

  /**
   * Activity status based on monthly activity rate
   *
   * - high_active: > 85%
   * - medium_active: 60-85%
   * - low_active: < 60% (at risk)
   * - churn_risk: < 60% with declining trend
   *
   * @story 7-3
   * @default null
   */
  @Column({ name: 'activity_status', type: 'varchar', length: 50, nullable: true })
  activityStatus?: 'high_active' | 'medium_active' | 'low_active' | 'churn_risk'
}
