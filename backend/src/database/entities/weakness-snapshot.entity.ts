import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'

import { Organization } from './organization.entity'
import { Project } from './project.entity'
import { WeaknessCategory } from '../../constants/categories'

/**
 * WeaknessSnapshot Entity
 *
 * Represents a snapshot of a weakness identified during assessment.
 * Weaknesses are areas where the organization has low maturity (level < 3).
 * Snapshots are created automatically when assessments complete.
 *
 * @table weakness_snapshots
 * @module backend/src/database/entities/weakness-snapshot.entity
 */
@Entity('weakness_snapshots')
@Index(['organizationId', 'category']) // Composite index for aggregation queries
export class WeaknessSnapshot {
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
   * Project ID (foreign key, optional)
   *
   * References projects.id
   * Indicates which project this weakness was identified from
   */
  @Column({ name: 'project_id', nullable: true })
  projectId: string

  /**
   * Weakness category
   *
   * Uses WeaknessCategory enum to ensure consistency
   * Categories: data_security, network_security, cloud_native, etc.
   *
   * @see WeaknessCategory
   */
  @Column({
    type: 'enum',
    enum: WeaknessCategory,
  })
  category: WeaknessCategory

  /**
   * Maturity level (1-5)
   *
   * Level definitions:
   * - 1: Initial stage (weakest)
   * - 2: Developing
   * - 3: Mature (baseline)
   * - 4: Optimizing
   *   - 5: Excellence (strongest)
   *
   * Weaknesses are areas with level < 3
   */
  @Column({ type: 'integer' })
  level: number

  /**
   * Human-readable description of the weakness
   *
   * Example: "成熟度等级 2，低于行业平均水平"
   */
  @Column({ type: 'text', nullable: true })
  description: string

  /**
   * List of project IDs that have this weakness
   *
   * Used for aggregation when multiple projects have the same weakness category.
   * Stored as JSONB array of UUID strings.
   *
   * Example: ["uuid1", "uuid2", "uuid3"]
   */
  @Column({ type: 'jsonb', nullable: true })
  projectIds: string[]

  /**
   * Timestamp when weakness snapshot was created
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  /**
   * Organization this weakness belongs to
   *
   * Many weakness snapshots can belong to one organization
   */
  @ManyToOne(() => Organization, (org) => org.weaknessSnapshots, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization

  /**
   * Project this weakness was identified from (if applicable)
   *
   * Many weakness snapshots can belong to one project
   */
  @ManyToOne(() => Project, (project) => project.weaknessSnapshots, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project
}
