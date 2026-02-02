import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm'
import { User } from './user.entity'
import { Organization } from './organization.entity'
import { AITask } from './ai-task.entity'
import { ProjectMember } from './project-member.entity'
import { StandardDocument } from './standard-document.entity'
import { CurrentStateDescription } from './current-state-description.entity'
import { WeaknessSnapshot } from './weakness-snapshot.entity'

export enum ProjectStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ name: 'client_name', nullable: true })
  clientName: string

  @Column({ name: 'standard_name', nullable: true })
  standardName: string

  /**
   * Tenant ID (Consulting Company)
   *
   * Foreign key to the Tenant table. Represents which consulting company
   * this project belongs to. Used for multi-tenant data isolation.
   *
   * Note: Projects inherit tenantId from their parent Organization.
   * This field is denormalized for query performance.
   *
   * @required After migration completes, this field becomes NOT NULL
   */
  @Column({ name: 'tenant_id', nullable: false })
  tenantId: string

  /**
   * Organization ID (foreign key)
   *
   * References organizations.id
   * Every project belongs to an organization
   */
  @Column({ name: 'organization_id', nullable: true })
  organizationId: string

  @ManyToOne(() => Organization, (organization) => organization.projects, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization

  @Column({ name: 'owner_id' })
  ownerId: string

  @ManyToOne(() => User, (user) => user.projects)
  @JoinColumn({ name: 'owner_id' })
  owner: User

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.DRAFT,
  })
  status: ProjectStatus

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date

  @OneToMany(() => AITask, (task) => task.project)
  tasks: AITask[]

  @OneToMany(() => ProjectMember, (member) => member.project)
  members: ProjectMember[]

  @OneToMany(() => StandardDocument, (doc) => doc.project)
  standardDocuments: StandardDocument[]

  @OneToMany(() => CurrentStateDescription, (desc) => desc.project)
  currentStateDescriptions: CurrentStateDescription[]

  /**
   * Weakness snapshots identified from this project
   *
   * One project can have multiple weakness snapshots
   */
  @OneToMany(() => WeaknessSnapshot, (weakness) => weakness.project)
  weaknessSnapshots: WeaknessSnapshot[]
}
