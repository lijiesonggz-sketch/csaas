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

/**
 * PushScheduleConfig Entity - 推送调度配置表
 *
 * 支持动态配置推送时间和策略
 *
 * 配置层级：
 * 1. 全局默认配置（organizationId = null）
 * 2. 组织级配置（organizationId = 具体组织ID）
 *
 * 配置优先级：
 * 组织级配置 > 全局默认配置
 *
 * 默认配置：
 * - 技术雷达：每周五17:00，最多推送5条，最低相关性0.7
 * - 行业雷达：每周三17:00，最多推送5条，最低相关性0.7
 * - 合规雷达：每天9:00，最多推送3条，最低相关性0.8
 *
 * Cron表达式格式：
 * - '0 17 * * 5' = 每周五17:00
 * - '0 17 * * 3' = 每周三17:00
 * - '0 9 * * *' = 每天9:00
 *
 * Story 2.3: 推送系统与调度
 */
@Entity('push_schedule_configs')
@Index(['organizationId', 'radarType'], { unique: true })
export class PushScheduleConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 组织ID
   * - null: 全局默认配置
   * - uuid: 组织级配置
   */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  organizationId: string | null

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization | null

  /**
   * 雷达类型
   * - tech: 技术雷达
   * - industry: 行业雷达
   * - compliance: 合规雷达
   */
  @Column({ type: 'enum', enum: ['tech', 'industry', 'compliance'] })
  radarType: 'tech' | 'industry' | 'compliance'

  /**
   * Cron表达式
   * 格式：'秒 分 时 日 月 周'
   *
   * 例如：
   * - '0 17 * * 5' = 每周五17:00
   * - '0 9 * * *' = 每天9:00
   * - '0 0 1 * *' = 每月1号0:00
   */
  @Column({ type: 'varchar', length: 100 })
  cronExpression: string

  /**
   * 时区
   * 例如：'Asia/Shanghai', 'UTC', 'America/New_York'
   */
  @Column({ type: 'varchar', length: 50, nullable: true, default: 'Asia/Shanghai' })
  timezone: string

  /**
   * 每次调度最多推送数量
   * 例如：5表示每次最多推送5条内容
   */
  @Column({ type: 'int', default: 5 })
  maxPushPerSchedule: number

  /**
   * 最低相关性评分阈值
   * 只有相关性评分 ≥ 此阈值的内容才会被推送
   * 范围：0.00 - 1.00
   */
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.7 })
  minRelevanceScore: number

  /**
   * 推送偏好
   *
   * {
   *   priorityLevels: ['high', 'medium'], // 只推送高优先级和中优先级
   *   excludeTags: ['Kubernetes'], // 排除包含这些标签的内容
   *   preferredSources: ['gartner', 'infoq'] // 偏好的信息源
   * }
   */
  @Column({ type: 'jsonb', nullable: true })
  preferences: {
    priorityLevels?: ('high' | 'medium' | 'low')[]
    excludeTags?: string[]
    preferredSources?: string[]
  } | null

  /**
   * 配置是否激活
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean

  /**
   * 上次执行时间
   */
  @Column({ type: 'timestamp', nullable: true })
  lastExecutedAt: Date | null

  /**
   * 下次执行时间
   * 由cronExpression计算得出
   */
  @Column({ type: 'timestamp', nullable: true })
  nextExecutionAt: Date | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
