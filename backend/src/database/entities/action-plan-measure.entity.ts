import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { AITask } from './ai-task.entity'

/**
 * 措施优先级枚举
 */
export enum MeasurePriority {
  HIGH = 'high', // 高优先级（差距大、影响大）
  MEDIUM = 'medium', // 中优先级
  LOW = 'low', // 低优先级（可后续推进）
}

/**
 * 措施实施状态枚举
 */
export enum MeasureStatus {
  PLANNED = 'planned', // 已规划（未开始）
  IN_PROGRESS = 'in_progress', // 进行中
  COMPLETED = 'completed', // 已完成
  BLOCKED = 'blocked', // 受阻
  CANCELLED = 'cancelled', // 已取消
}

/**
 * 落地措施实体
 * 用于存储成熟度改进的具体措施
 */
@Entity('action_plan_measures')
export class ActionPlanMeasure {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 关联的AI任务ID（落地措施生成任务）
   */
  @Column({ name: 'task_id' })
  taskId: string

  @ManyToOne(() => AITask)
  @JoinColumn({ name: 'task_id' })
  task: AITask

  /**
   * 关联的问卷响应ID
   */
  @Column({ name: 'survey_response_id' })
  surveyResponseId: string

  /**
   * 聚类信息
   */
  @Column({ name: 'cluster_name', length: 200 })
  clusterName: string

  @Column({ name: 'cluster_id', nullable: true })
  clusterId: string

  /**
   * 成熟度信息
   */
  @Column({ name: 'current_level', type: 'float' })
  currentLevel: number

  @Column({ name: 'target_level', type: 'float' })
  targetLevel: number

  @Column({ type: 'float' })
  gap: number

  /**
   * 措施基本信息
   */
  @Column({
    type: 'enum',
    enum: MeasurePriority,
    default: MeasurePriority.MEDIUM,
  })
  priority: MeasurePriority

  @Column({ type: 'varchar', length: 500 })
  title: string

  @Column({ type: 'text' })
  description: string

  /**
   * 实施步骤（JSONB数组）
   * 结构：[
   *   { stepNumber: 1, title: "步骤标题", description: "详细说明", duration: "1个月" },
   *   { stepNumber: 2, title: "...", description: "...", duration: "2周" }
   * ]
   */
  @Column({ type: 'jsonb', name: 'implementation_steps' })
  implementationSteps: Array<{
    stepNumber: number
    title: string
    description: string
    duration: string
  }>

  /**
   * 时间线
   * 格式示例："3-6个月", "1年", "短期（3个月内）"
   */
  @Column({ type: 'varchar', length: 100 })
  timeline: string

  /**
   * 负责部门/角色
   */
  @Column({ type: 'varchar', length: 200, name: 'responsible_department' })
  responsibleDepartment: string

  /**
   * 预期提升效果
   */
  @Column({ type: 'float', name: 'expected_improvement' })
  expectedImprovement: number

  /**
   * 所需资源（JSONB）
   * 结构：{
   *   budget: "50万元",
   *   personnel: ["数据安全专家2名", "开发人员3名"],
   *   technology: ["数据加密系统", "审计日志平台"],
   *   training: "全员数据安全培训"
   * }
   */
  @Column({ type: 'jsonb', name: 'resources_needed', nullable: true })
  resourcesNeeded: {
    budget?: string
    personnel?: string[]
    technology?: string[]
    training?: string
  }

  /**
   * 依赖关系（JSONB）
   * 结构：{
   *   prerequisiteMeasures: ["measure_id_1", "measure_id_2"],
   *   externalDependencies: ["完成组织架构调整", "获得管理层批准"]
   * }
   */
  @Column({ type: 'jsonb', nullable: true })
  dependencies: {
    prerequisiteMeasures?: string[]
    externalDependencies?: string[]
  }

  /**
   * 风险点（JSONB数组）
   * 结构：[
   *   { risk: "人员流失", mitigation: "建立知识库和文档" },
   *   { risk: "预算不足", mitigation: "分阶段实施" }
   * ]
   */
  @Column({ type: 'jsonb', nullable: true })
  risks: Array<{
    risk: string
    mitigation: string
  }>

  /**
   * KPI指标（JSONB数组）
   * 结构：[
   *   { metric: "数据分类覆盖率", target: "90%", measurementMethod: "季度审计" },
   *   { metric: "安全事件响应时间", target: "<2小时", measurementMethod: "事件记录分析" }
   * ]
   */
  @Column({ type: 'jsonb', name: 'kpi_metrics', nullable: true })
  kpiMetrics: Array<{
    metric: string
    target: string
    measurementMethod: string
  }>

  /**
   * 实施状态
   */
  @Column({
    type: 'enum',
    enum: MeasureStatus,
    default: MeasureStatus.PLANNED,
  })
  status: MeasureStatus

  /**
   * 实施进度（0-100）
   */
  @Column({ type: 'int', default: 0 })
  progress: number

  /**
   * 实施备注
   */
  @Column({ type: 'text', nullable: true })
  notes: string

  /**
   * AI模型来源
   */
  @Column({ type: 'varchar', length: 50, name: 'ai_model', nullable: true })
  aiModel: string

  /**
   * 排序序号
   */
  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number

  /**
   * 时间戳
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt: Date

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date
}
