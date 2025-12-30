import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'
import { AITask } from './ai-task.entity'

/**
 * 问卷填写状态枚举
 */
export enum SurveyStatus {
  DRAFT = 'draft', // 草稿（未提交）
  SUBMITTED = 'submitted', // 已提交
  COMPLETED = 'completed', // 已完成（已生成落地措施）
}

/**
 * 问卷填写记录实体
 * 用于存储企业用户填写的调研问卷答案
 */
@Entity('survey_responses')
export class SurveyResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 关联的问卷任务ID（问卷生成任务）
   */
  @Column({ name: 'questionnaire_task_id' })
  questionnaireTaskId: string

  @ManyToOne(() => AITask, { nullable: true })
  @JoinColumn({ name: 'questionnaire_task_id' })
  questionnaireTask: AITask

  /**
   * 填写人信息
   */
  @Column({ name: 'respondent_name', length: 100 })
  respondentName: string

  @Column({ name: 'respondent_email', length: 200, nullable: true })
  respondentEmail: string

  @Column({ name: 'respondent_department', length: 200, nullable: true })
  respondentDepartment: string

  @Column({ name: 'respondent_position', length: 100, nullable: true })
  respondentPosition: string

  /**
   * 填写状态
   */
  @Column({
    type: 'enum',
    enum: SurveyStatus,
    default: SurveyStatus.DRAFT,
  })
  status: SurveyStatus

  /**
   * 所有答案（JSON格式存储）
   * 结构：{
   *   "Q001": { "answer": "A", "score": 3 },
   *   "Q002": { "answer": ["A", "C"], "score": 4 },
   *   ...
   * }
   */
  @Column({ type: 'jsonb' })
  answers: Record<string, any>

  /**
   * 答题进度（0-100）
   */
  @Column({ name: 'progress_percentage', type: 'int', default: 0 })
  progressPercentage: number

  /**
   * 总分统计
   */
  @Column({ name: 'total_score', type: 'float', nullable: true })
  totalScore: number

  @Column({ name: 'max_score', type: 'float', nullable: true })
  maxScore: number

  /**
   * 时间戳
   */
  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  /**
   * 备注信息
   */
  @Column({ type: 'text', nullable: true })
  notes: string
}
