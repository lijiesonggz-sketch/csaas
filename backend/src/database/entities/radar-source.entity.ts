import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

/**
 * RadarSource Entity - 雷达信息源配置表
 *
 * 存储技术雷达、行业雷达、合规雷达的信息源配置
 * 替代硬编码的配置文件，支持通过管理界面动态管理
 *
 * Story 3.1: 配置行业雷达信息源
 * Story 4.1: 合规雷达信息源配置（添加source + category唯一约束）
 */
@Entity('radar_sources')
@Index(['category'])
@Index(['isActive'])
@Index(['source', 'category'], { unique: true }) // Story 4.1: 同一category下source唯一
export class RadarSource {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 信息源名称
   * 例如：'杭州银行金融科技'、'拉勾网-金融机构招聘'
   */
  @Column({ type: 'varchar', length: 255 })
  source: string

  /**
   * 雷达类型
   * - tech: 技术雷达
   * - industry: 行业雷达
   * - compliance: 合规雷达
   */
  @Column({
    type: 'enum',
    enum: ['tech', 'industry', 'compliance'],
  })
  @Index()
  category: 'tech' | 'industry' | 'compliance'

  /**
   * 目标URL
   * 爬虫将访问此URL获取内容
   */
  @Column({ type: 'varchar', length: 1000 })
  url: string

  /**
   * 内容类型
   * - wechat: 微信公众号
   * - recruitment: 招聘网站
   * - conference: 会议/活动
   * - website: 普通网站
   */
  @Column({
    type: 'enum',
    enum: ['wechat', 'recruitment', 'conference', 'website'],
  })
  type: 'wechat' | 'recruitment' | 'conference' | 'website'

  /**
   * 同业机构名称（可选）
   * 用于行业雷达，标识信息来源的同业机构
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  peerName?: string

  /**
   * 是否启用
   * 禁用的信息源不会被爬虫处理
   */
  @Column({ type: 'boolean', default: true })
  @Index()
  isActive: boolean

  /**
   * 爬取频率（cron表达式）
   * 默认：每天凌晨3点执行
   * 例如：'0 3 * * *'
   */
  @Column({ type: 'varchar', length: 100, default: '0 3 * * *' })
  crawlSchedule: string

  /**
   * 最后爬取时间
   */
  @Column({ type: 'timestamp', nullable: true })
  lastCrawledAt?: Date

  /**
   * 最后爬取状态
   * - pending: 待爬取
   * - success: 爬取成功
   * - failed: 爬取失败
   */
  @Column({
    type: 'enum',
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
  })
  lastCrawlStatus: 'pending' | 'success' | 'failed'

  /**
   * 最后爬取错误信息（失败时）
   */
  @Column({ type: 'text', nullable: true })
  lastCrawlError?: string

  /**
   * 爬虫配置（JSONB）
   * 用于同业采集源的选择器配置
   * Story 8.1: 同业采集源管理
   */
  @Column({ type: 'jsonb', nullable: true, name: 'crawlConfig' })
  crawlConfig?: {
    selector?: string
    listSelector?: string
    titleSelector?: string
    contentSelector?: string
    dateSelector?: string
    authorSelector?: string
    paginationPattern?: string
    maxPages?: number
  }

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
