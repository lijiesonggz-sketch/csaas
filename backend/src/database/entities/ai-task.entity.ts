import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm'
import { Project } from './project.entity'
import { AIGenerationEvent } from './ai-generation-event.entity'
import { AICostTracking } from './ai-cost-tracking.entity'

export enum AITaskType {
  SUMMARY = 'summary', // 综述生成
  CLUSTERING = 'clustering', // 聚类分析
  MATRIX = 'matrix', // 矩阵生成
  QUESTIONNAIRE = 'questionnaire', // 问卷生成
  ACTION_PLAN = 'action_plan', // 落地措施
}

export enum AITaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  MANUAL_MODE = 'manual_mode', // Level 4降级
  LOW_CONFIDENCE = 'low_confidence', // Level 3降级
}

export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('ai_tasks')
export class AITask {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'project_id' })
  projectId: string

  @ManyToOne(() => Project, (project) => project.tasks)
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({
    type: 'enum',
    enum: AITaskType,
  })
  type: AITaskType

  @Column({
    type: 'enum',
    enum: AITaskStatus,
    default: AITaskStatus.PENDING,
  })
  status: AITaskStatus

  @Column({
    type: 'enum',
    enum: TaskPriority,
    default: TaskPriority.NORMAL,
  })
  priority: TaskPriority

  @Column({ type: 'text', nullable: true })
  input: string

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any>

  @Column({ type: 'float', default: 0 })
  progress: number

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date

  @OneToMany(() => AIGenerationEvent, (event) => event.task)
  events: AIGenerationEvent[]

  @OneToMany(() => AICostTracking, (cost) => cost.task)
  costs: AICostTracking[]
}
