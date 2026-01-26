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
 * 标准文档实体
 * 用于存储单一标准文档的内容和元数据
 */
@Entity('standard_documents')
export class StandardDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 标准名称，如 "GB/T 22239-2019"
   */
  @Column()
  name: string

  /**
   * 标准全文内容（解析后的文本）
   */
  @Column({ type: 'text' })
  content: string

  /**
   * 标准元数据（JSON格式）
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    standard_code?: string // "GB/T 22239-2019"
    version?: string // "2019"
    publish_date?: string
    category?: string // "国家标准", "行业标准"
    [key: string]: any
  }

  /**
   * 关联的项目ID（可选）
   */
  @Column({ name: 'project_id', nullable: true })
  projectId: string

  @ManyToOne(() => Project, (project) => project.standardDocuments)
  @JoinColumn({ name: 'project_id' })
  project: Project

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
