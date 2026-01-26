import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm'
import { Project } from './project.entity'

/**
 * 用户现状描述实体
 * 用于存储用户输入的企业现状文字描述
 */
@Entity('current_state_descriptions')
export class CurrentStateDescription {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 关联的项目ID
   */
  @Column({ name: 'project_id' })
  projectId: string

  @ManyToOne(() => Project, (project) => project.currentStateDescriptions)
  @JoinColumn({ name: 'project_id' })
  project: Project

  /**
   * 用户输入的文字版现状描述
   */
  @Column({ type: 'text' })
  description: string

  /**
   * 元数据（JSON格式）
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    source?: 'MANUAL_INPUT' | 'DOC_UPLOAD'
    word_count?: number
    extracted_keywords?: string[]
    [key: string]: any
  }

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
