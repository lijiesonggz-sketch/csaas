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

export enum UserRole {
  CONSULTANT = 'consultant', // 主咨询师
  CLIENT_PM = 'client_pm', // 企业PM
  RESPONDENT = 'respondent', // 被调研者
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
}
