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
  // 新增类型
  STANDARD_INTERPRETATION = 'standard_interpretation', // 标准解读
  STANDARD_RELATED_SEARCH = 'standard_related_search', // 关联标准搜索
  STANDARD_VERSION_COMPARE = 'standard_version_compare', // 标准版本比对
  BINARY_QUESTIONNAIRE = 'binary_questionnaire', // 判断题问卷
  BINARY_GAP_ANALYSIS = 'binary_gap_analysis', // 判断题差距分析
  QUICK_GAP_ANALYSIS = 'quick_gap_analysis', // 超简版差距分析
}

export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  MANUAL_MODE = 'manual_mode', // Level 4降级
  LOW_CONFIDENCE = 'low_confidence', // Level 3降级
}

export enum GenerationStage {
  PENDING = 'pending',
  GENERATING_MODELS = 'generating_models', // 模型生成中
  QUALITY_VALIDATION = 'quality_validation', // 质量校验中
  AGGREGATING = 'aggregating', // 结果聚合中
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ModelProgress {
  status: 'pending' | 'generating' | 'completed' | 'failed'
  started_at?: string
  completed_at?: string
  error?: string
  tokens?: number
  cost?: number
  duration_ms?: number
}

export interface TaskProgressDetails {
  gpt4?: ModelProgress
  claude?: ModelProgress
  domestic?: ModelProgress
  current?: ModelProgress // 新的单模型进度字段（用于新任务系统）
  validation_stage?: 'pending' | 'validating' | 'completed' | 'failed'
  aggregation_stage?: 'pending' | 'aggregating' | 'completed' | 'failed'
  current_model?: 'gpt4' | 'claude' | 'domestic'
  total_elapsed_ms?: number
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
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  status: TaskStatus

  @Column({
    type: 'enum',
    enum: GenerationStage,
    default: GenerationStage.PENDING,
    name: 'generation_stage',
  })
  generationStage: GenerationStage

  @Column({ type: 'jsonb', nullable: true, name: 'progress_details' })
  progressDetails: TaskProgressDetails

  @Column({ type: 'integer', default: 1 })
  priority: number

  @Column({ type: 'jsonb' })
  input: Record<string, any>

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any>

  // ✅ 聚类生成状态（用于断点续跑）
  @Column({ type: 'jsonb', nullable: true, name: 'cluster_generation_status' })
  clusterGenerationStatus: {
    totalClusters: number
    completedClusters: string[] // 已完成的聚类ID列表
    failedClusters: string[] // 失败的聚类ID列表
    pendingClusters: string[] // 待生成的聚类ID列表
    clusterProgress: Record<
      string,
      {
        // 每个聚类的详细进度
        clusterId: string
        clusterName: string
        status: 'pending' | 'generating' | 'completed' | 'failed'
        questionsGenerated: number
        questionsExpected: number
        startedAt?: string
        completedAt?: string
        error?: string
      }
    >
  }

  @Column({ name: 'backup_result', type: 'jsonb', nullable: true })
  backupResult: Record<string, any>

  @Column({ name: 'backup_created_at', type: 'timestamp', nullable: true })
  backupCreatedAt: Date

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
