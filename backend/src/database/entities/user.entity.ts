import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm'
import { Project } from './project.entity'
import { OrganizationMember } from './organization-member.entity'

export enum UserRole {
  CONSULTANT = 'consultant', // 主咨询师
  CLIENT_PM = 'client_pm', // 企业PM
  RESPONDENT = 'respondent', // 被调研者
  ADMIN = 'admin', // 管理员 (Story 6-2)
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  email: string

  @Column({ name: 'password_hash' })
  passwordHash: string

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.RESPONDENT,
  })
  role: UserRole

  @Column({ nullable: true })
  name: string

  /**
   * @deprecated Tenant ID is deprecated in favor of organization-based multi-tenancy.
   * This field will be removed in Story 6.1 (Multi-tenant data model).
   * All new code should use organizationId via OrganizationMember relationship.
   */
  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date

  @OneToMany(() => Project, (project) => project.owner)
  projects: Project[]

  /**
   * Organization memberships for this user
   *
   * One user can belong to multiple organizations (Growth phase Story 6.1)
   */
  @OneToMany(() => OrganizationMember, (member) => member.user)
  organizationMembers: OrganizationMember[]
}
