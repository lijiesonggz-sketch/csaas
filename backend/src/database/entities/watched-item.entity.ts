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
import { Tag } from './tag.entity'

/**
 * WatchedItem Entity - 用户关注项
 *
 * 统一管理用户关注的所有类型的标签：
 * - 技术领域（tech）：云原生、AI应用、Kubernetes等
 * - 同业机构（peer）：杭州银行、招商银行等
 * - 合规标签（compliance）：数据安全法、GDPR等
 * - 供应商（vendor）：阿里云、华为等
 *
 * 用途：
 * - Story 1.4: 用户引导时创建关注项
 * - Story 2.3: 计算推送内容的相关性评分
 * - Epic 3: 行业雷达推送
 * - Epic 4: 合规雷达推送
 *
 * 相关性计算：
 * relevanceScore = (薄弱项匹配度 * 0.6) + (关注项匹配度 * 0.4)
 * 关注项的weight字段用于调整匹配权重
 */
@Entity('watched_items')
@Index(['organizationId', 'tagId'], { unique: true })
export class WatchedItem {
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
   * 关联的标签ID
   */
  @Column({ type: 'uuid' })
  @Index()
  tagId: string

  @ManyToOne(() => Tag)
  @JoinColumn({ name: 'tagId' })
  tag: Tag

  /**
   * 关注类型（冗余字段，方便查询）
   * 与tag.tagType保持一致
   */
  @Column({
    type: 'enum',
    enum: ['tech', 'peer', 'compliance', 'vendor', 'custom'],
  })
  @Index()
  watchType: 'tech' | 'peer' | 'compliance' | 'vendor' | 'custom'

  /**
   * 权重（用于相关性计算）
   * 范围：0.5 - 1.5
   * 默认：1.0
   *
   * 用户可以调整权重来表达对某个关注项的重视程度：
   * - 1.5: 非常关注
   * - 1.0: 正常关注
   * - 0.5: 一般关注
   */
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  weight: number

  /**
   * 关注偏好（根据watchType不同，存储不同的偏好）
   *
   * 技术领域偏好：
   * {
   *   focusAreas: ['实施案例', 'ROI分析', '技术架构'],
   *   notificationEnabled: true,
   *   priority: 'high'
   * }
   *
   * 同业机构偏好：
   * {
   *   focusTopics: ['技术创新', '数字化转型', '风险管理'],
   *   notificationEnabled: true,
   *   priority: 'medium'
   * }
   */
  @Column({ type: 'jsonb', nullable: true })
  preferences: {
    // 技术领域偏好
    focusAreas?: string[]

    // 同业机构偏好
    focusTopics?: string[]

    // 通用偏好
    notificationEnabled?: boolean
    priority?: 'high' | 'medium' | 'low'
  } | null

  /**
   * 是否激活
   * 用户可以暂时停用某个关注项，而不删除它
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
