import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'

import { Organization } from './organization.entity'
import { User } from './user.entity'

/**
 * OrganizationMember Entity
 *
 * Represents the membership relationship between users and organizations.
 * A user can be a member of multiple organizations (in Growth phase Story 6.1).
 * Each membership has a role: admin or member.
 *
 * @table organization_members
 * @module backend/src/database/entities/organization-member.entity
 */
@Entity('organization_members')
export class OrganizationMember {
  /**
   * Primary key - UUID v4
   */
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * Organization ID (foreign key)
   *
   * References organizations.id
   */
  @Column({ name: 'organization_id' })
  organizationId: string

  /**
   * User ID (foreign key)
   *
   * References users.id
   */
  @Column({ name: 'user_id' })
  userId: string

  /**
   * Member role within the organization
   *
   * MVP: Only 'admin' and 'member' roles
   * Growth (Story 6.1): May add more roles like 'consultant', 'viewer'
   *
   * @enum {admin, member}
   */
  @Column({
    type: 'enum',
    enum: ['admin', 'member'],
    default: 'member',
  })
  role: 'admin' | 'member'

  /**
   * Timestamp when membership was created
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  /**
   * Organization this member belongs to
   *
   * Many organization members can belong to one organization
   */
  @ManyToOne(() => Organization, (org) => org.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization

  /**
   * User who is the member
   *
   * Many organization members can belong to one user
   */
  @ManyToOne(() => User, (user) => user.organizationMembers)
  @JoinColumn({ name: 'user_id' })
  user: User
}
