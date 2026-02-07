import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm'

import { ClientGroup } from './client-group.entity'
import { Organization } from './organization.entity'

/**
 * Client Group Membership Entity
 *
 * Represents the many-to-many relationship between client groups and organizations.
 * An organization can belong to multiple groups, and a group can have multiple organizations.
 *
 * @table client_group_memberships
 * @story 6-2
 * @module backend/src/database/entities/client-group-membership.entity
 */
@Entity('client_group_memberships')
@Unique(['groupId', 'organizationId'])
export class ClientGroupMembership {
  /**
   * Primary key - UUID v4
   */
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * Group ID
   *
   * Foreign key to the ClientGroup table.
   */
  @Column({ name: 'group_id', type: 'uuid', nullable: false })
  groupId: string

  /**
   * Group relationship
   */
  @ManyToOne(() => ClientGroup, (group) => group.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  group: ClientGroup

  /**
   * Organization ID
   *
   * Foreign key to the Organization table.
   */
  @Column({ name: 'organization_id', type: 'uuid', nullable: false })
  organizationId: string

  /**
   * Organization relationship
   */
  @ManyToOne(() => Organization, (org) => org.groupMemberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization

  /**
   * Timestamp when membership was created
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
