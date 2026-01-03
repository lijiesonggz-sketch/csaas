import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Project } from './project.entity'
import { User } from './user.entity'

export enum ProjectMemberRole {
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

@Entity('project_members')
export class ProjectMember {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'project_id' })
  projectId: string

  @ManyToOne(() => Project, (project) => project.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ name: 'user_id' })
  userId: string

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User

  @Column({
    type: 'varchar',
    length: 20,
  })
  role: ProjectMemberRole

  @Column({ name: 'added_at', type: 'timestamp' })
  addedAt: Date

  @Column({ name: 'added_by', nullable: true })
  addedBy: string
}
