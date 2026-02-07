import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm'

import { Tenant } from './tenant.entity'
import { ClientGroupMembership } from './client-group-membership.entity'

/**
 * Client Group Entity
 *
 * Represents a group of clients (organizations) for bulk management.
 * Used by consulting companies to organize their clients into categories
 * like "城商行客户" or "试用客户".
 *
 * @table client_groups
 * @story 6-2
 * @module backend/src/database/entities/client-group.entity
 */
@Entity('client_groups')
export class ClientGroup {
  /**
   * Primary key - UUID v4
   */
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * Group name
   *
   * Display name for this client group.
   * Example: "城商行客户", "试用客户", "VIP客户"
   */
  @Column({ type: 'varchar', length: 255 })
  name: string

  /**
   * Group description
   *
   * Optional description explaining the purpose of this group.
   */
  @Column({ type: 'text', nullable: true })
  description?: string

  /**
   * Tenant ID (Consulting Company)
   *
   * Foreign key to the Tenant table. Each group belongs to one tenant.
   */
  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  tenantId: string

  /**
   * Tenant relationship
   */
  @ManyToOne(() => Tenant, (tenant) => tenant.organizations)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant

  /**
   * Timestamp when group was created
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  /**
   * Timestamp when group was last updated
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  /**
   * Memberships in this group
   *
   * Links to all organizations that belong to this group.
   */
  @OneToMany(() => ClientGroupMembership, (membership) => membership.group, {
    onDelete: 'CASCADE',
  })
  memberships: ClientGroupMembership[]
}
