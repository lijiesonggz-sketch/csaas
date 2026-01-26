import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm'
import { AITask } from './ai-task.entity'

/**
 * 标准解读结果实体
 * 用于存储标准解读、关联标准搜索、版本比对的结果
 */
@Entity('interpretation_results')
export class InterpretationResult {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 关联的AI任务ID
   */
  @Column({ name: 'task_id' })
  taskId: string

  @ManyToOne(() => AITask, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: AITask

  /**
   * 标准解读结果
   */
  @Column({ type: 'jsonb' })
  interpretation: {
    overview: string // 标准概述
    scope: string // 适用范围
    key_requirements: Array<{
      clause_id: string
      title: string
      description: string
      importance: 'HIGH' | 'MEDIUM' | 'LOW'
    }>
    implementation_guidance: string // 实施指引
  }

  /**
   * 关联标准搜索结果（可选）
   */
  @Column({ type: 'jsonb', nullable: true })
  related_standards: {
    clause_id: string
    clause_text: string
    related_standards: Array<{
      code: string
      title: string
      relevance: string // 关联原因
      similarity: number // 相似度 0-1
    }>
  }[]

  /**
   * 版本比对结果（可选）
   */
  @Column({ type: 'jsonb', nullable: true })
  version_comparison: {
    old_version: string
    new_version: string
    comparison: Array<{
      clause_id: string
      change_type: 'ADDED' | 'MODIFIED' | 'DELETED'
      old_content?: string
      new_content?: string
      impact: 'HIGH' | 'MEDIUM' | 'LOW'
    }>
    summary: string // 总体变化摘要
  }

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
