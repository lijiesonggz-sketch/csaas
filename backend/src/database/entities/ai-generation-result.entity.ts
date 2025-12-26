import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { AITask, AITaskType } from './ai-task.entity'
import { User } from './user.entity'

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  MODIFIED = 'modified',
  REJECTED = 'rejected',
}

export enum ConfidenceLevel {
  HIGH = 'high', // ≥85%
  MEDIUM = 'medium', // 75-85%
  LOW = 'low', // <75%
}

export enum SelectedModel {
  GPT4 = 'gpt4',
  CLAUDE = 'claude',
  DOMESTIC = 'domestic',
}

@Entity('ai_generation_results')
export class AIGenerationResult {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'task_id' })
  taskId: string

  @ManyToOne(() => AITask)
  @JoinColumn({ name: 'task_id' })
  task: AITask

  @Column({
    type: 'enum',
    enum: AITaskType,
    name: 'generation_type',
  })
  generationType: AITaskType

  // AI生成的原始结果（三模型输出）
  @Column({ type: 'jsonb', nullable: true, name: 'gpt4_result' })
  gpt4Result: Record<string, any>

  @Column({ type: 'jsonb', nullable: true, name: 'claude_result' })
  claudeResult: Record<string, any>

  @Column({ type: 'jsonb', nullable: true, name: 'domestic_result' })
  domesticResult: Record<string, any>

  // 质量验证结果
  @Column({ type: 'jsonb', nullable: true, name: 'quality_scores' })
  qualityScores: {
    structural?: number // 结构一致性 0-1
    semantic?: number // 语义等价性 0-1
    detail?: number // 细节一致性 0-1
  }

  @Column({ type: 'jsonb', nullable: true, name: 'consistency_report' })
  consistencyReport: {
    agreements?: string[] // 一致的地方
    disagreements?: string[] // 分歧点
    highRiskDisagreements?: string[] // 高风险差异点
  }

  @Column({ type: 'jsonb', nullable: true, name: 'coverage_report' })
  coverageReport: {
    totalClauses?: number // 总条款数
    coveredClauses?: string[] // 已覆盖的条款ID
    missingClauses?: string[] // 遗漏的条款ID
    coverageRate?: number // 覆盖率 0-1
  }

  // 最终选择的结果（投票后）
  @Column({ type: 'jsonb', nullable: true, name: 'selected_result' })
  selectedResult: Record<string, any>

  @Column({
    type: 'enum',
    enum: SelectedModel,
    nullable: true,
    name: 'selected_model',
  })
  selectedModel: SelectedModel

  @Column({
    type: 'enum',
    enum: ConfidenceLevel,
    nullable: true,
    name: 'confidence_level',
  })
  confidenceLevel: ConfidenceLevel

  // 人工审核状态
  @Column({
    type: 'enum',
    enum: ReviewStatus,
    default: ReviewStatus.PENDING,
    name: 'review_status',
  })
  reviewStatus: ReviewStatus

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy: string

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: User

  @Column({ type: 'timestamp', nullable: true, name: 'reviewed_at' })
  reviewedAt: Date

  @Column({ type: 'jsonb', nullable: true, name: 'modified_result' })
  modifiedResult: Record<string, any>

  @Column({ type: 'text', nullable: true, name: 'review_notes' })
  reviewNotes: string

  // 版本控制
  @Column({ type: 'integer', default: 1 })
  version: number

  // 时间戳
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
