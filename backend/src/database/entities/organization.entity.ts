import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm'

import { OrganizationMember } from './organization-member.entity'
import { Project } from './project.entity'
import { WeaknessSnapshot } from './weakness-snapshot.entity'

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
}
