import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm'

import { OrganizationMember } from './organization-member.entity'
import { Project } from './project.entity'
import { WeaknessSnapshot } from './weakness-snapshot.entity'
import { WatchedTopic } from './watched-topic.entity'
import { WatchedPeer } from './watched-peer.entity'
import { Tenant } from './tenant.entity'

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
  @Column({ type: 'varchar', length: 50, nullable: true })
  industry?: string

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
}
