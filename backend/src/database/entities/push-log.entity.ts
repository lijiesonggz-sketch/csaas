import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { RadarPush } from './radar-push.entity'

/**
 * PushLog Entity - 推送日志表
 *
 * Story 2.3: 推送系统与调度
 *
 * 核心功能：
 * - 记录推送成功/失败日志
 * - 跟踪推送重试历史
 * - 记录详细错误信息用于问题排查
 * - 支持推送成功率统计
 *
 * 使用场景：
 * 1. 推送成功 → 创建success日志
 * 2. 推送失败 → 创建failed日志 + 错误信息
 * 3. 失败重试 → 更新retryCount
 * 4. 推送成功率计算：success数 / 总数 ≥ 98%
 */
@Entity('push_logs')
export class PushLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 关联的推送记录ID
   */
  @Column({ type: 'uuid' })
  @Index()
  pushId: string

  @ManyToOne(() => RadarPush)
  @JoinColumn({ name: 'pushId' })
  push: RadarPush

  /**
   * 推送状态
   * - success: 推送成功
   * - failed: 推送失败
   */
  @Column({ type: 'enum', enum: ['success', 'failed'] })
  status: 'success' | 'failed'

  /**
   * 错误信息（仅失败时记录）
   * 用于问题排查和告警
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null

  /**
   * 重试次数
   * 记录该推送重试了多少次
   * 最多重试1次（失败后5分钟重试）
   */
  @Column({ type: 'int', default: 0 })
  retryCount: number

  /**
   * 创建时间
   * 即推送尝试时间
   */
  @CreateDateColumn()
  createdAt: Date
}
