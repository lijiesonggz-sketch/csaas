import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { Organization } from './organization.entity'
import { AnalyzedContent } from './analyzed-content.entity'
import { PushScheduleConfig } from './push-schedule-config.entity'

/**
 * RadarPush Entity - 雷达推送记录
 *
 * 核心推送表，支持三大雷达：
 * - tech: 技术雷达（每周五17:00推送）
 * - industry: 行业雷达（每周三17:00推送）
 * - compliance: 合规雷达（每日9:00推送）
 *
 * 推送流程：
 * 1. AI分析完成 → 计算相关性评分
 * 2. 相关性评分 ≥ 阈值 → 创建RadarPush记录（status: scheduled）
 * 3. 调度时间到达 → WebSocket推送（status: sent）
 * 4. 用户阅读 → 更新isRead和readAt
 *
 * 相关性评分算法：
 * relevanceScore = (薄弱项匹配度 * 0.6) + (关注项匹配度 * 0.4)
 * - ≥ 0.9: 高相关（priorityLevel: high）
 * - 0.7-0.9: 中相关（priorityLevel: medium）
 * - < 0.7: 低相关（priorityLevel: low）
 *
 * Story 2.3: 推送系统与调度
 */
@Entity('radar_pushes')
@Index(['organizationId', 'radarType', 'status'])
@Index(['scheduledAt', 'status'])
@Index(['relevanceScore'])
export class RadarPush {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 所属组织ID
   */
  @Column({ type: 'uuid' })
  @Index()
  organizationId: string

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization

  /**
   * 雷达类型
   * - tech: 技术雷达
   * - industry: 行业雷达
   * - compliance: 合规雷达
   */
  @Column({ type: 'enum', enum: ['tech', 'industry', 'compliance'] })
  radarType: 'tech' | 'industry' | 'compliance'

  /**
   * 关联的分析内容ID
   */
  @Column({ type: 'uuid' })
  contentId: string

  @ManyToOne(() => AnalyzedContent)
  @JoinColumn({ name: 'contentId' })
  analyzedContent: AnalyzedContent

  /**
   * 相关性评分（0.00 - 1.00）
   * 基于薄弱项和关注项的匹配度计算
   */
  @Column({ type: 'decimal', precision: 3, scale: 2 })
  relevanceScore: number

  /**
   * 优先级
   * - high: 高相关（relevanceScore ≥ 0.9）
   * - medium: 中相关（0.7 ≤ relevanceScore < 0.9）
   * - low: 低相关（relevanceScore < 0.7）
   */
  @Column({ type: 'enum', enum: ['high', 'medium', 'low'] })
  priorityLevel: 'high' | 'medium' | 'low'

  /**
   * 计划推送时间
   * 由PushScheduleConfig的cronExpression计算得出
   */
  @Column({ type: 'timestamp' })
  scheduledAt: Date

  /**
   * 推送状态
   * - scheduled: 已调度，等待推送
   * - sent: 已推送
   * - failed: 推送失败
   * - cancelled: 已取消
   */
  @Column({
    type: 'enum',
    enum: ['scheduled', 'sent', 'failed', 'cancelled'],
    default: 'scheduled',
  })
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled'

  /**
   * 实际推送时间
   */
  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null

  /**
   * 用户是否已读
   */
  @Column({ type: 'boolean', default: false })
  isRead: boolean

  /**
   * 用户阅读时间
   */
  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null

  /**
   * 用户是否收藏
   */
  @Column({ type: 'boolean', default: false })
  isBookmarked: boolean

  /**
   * 关联的调度配置ID
   * 记录使用的是哪个调度配置
   *
   * TODO (Story 2.3 Code Review 问题3):
   * 等待push_schedule_configs表迁移创建后，需要添加FK约束：
   * CONSTRAINT "FK_radar_pushes_scheduleConfigId"
   *   FOREIGN KEY ("scheduleConfigId")
   *   REFERENCES "push_schedule_configs"("id")
   *   ON DELETE SET NULL
   */
  @Column({ type: 'uuid', nullable: true })
  scheduleConfigId: string | null

  @ManyToOne(() => PushScheduleConfig, { nullable: true })
  @JoinColumn({ name: 'scheduleConfigId' })
  scheduleConfig: PushScheduleConfig | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
