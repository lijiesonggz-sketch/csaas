import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm'

/**
 * PeerCrawlerTask Entity - 同业采集任务追踪表
 *
 * 记录每次同业采集任务的执行状态和结果
 *
 * Story 8.2: 同业采集任务调度与执行
 */
@Entity('peer_crawler_tasks')
@Index(['sourceId'])
@Index(['status'])
@Index(['tenantId'])
@Index(['createdAt'])
export class PeerCrawlerTask {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 关联的 RadarSource ID
   */
  @Column({ type: 'uuid' })
  @Index()
  sourceId: string

  /**
   * 同业机构名称（冗余存储便于查询）
   */
  @Column({ type: 'varchar', length: 255 })
  peerName: string

  /**
   * 租户ID（多租户隔离）
   */
  @Column({ type: 'uuid' })
  @Index()
  tenantId: string

  /**
   * 任务状态
   * - pending: 待处理
   * - running: 执行中
   * - completed: 已完成
   * - failed: 失败
   */
  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
  })
  @Index()
  status: 'pending' | 'running' | 'completed' | 'failed'

  /**
   * 采集源类型
   * - website: 普通网站
   * - wechat: 微信公众号
   * - recruitment: 招聘网站
   * - conference: 会议/活动
   */
  @Column({
    type: 'enum',
    enum: ['website', 'wechat', 'recruitment', 'conference'],
  })
  sourceType: 'website' | 'wechat' | 'recruitment' | 'conference'

  /**
   * 采集目标URL
   */
  @Column({ type: 'varchar', length: 1000 })
  targetUrl: string

  /**
   * 采集结果
   * 包含标题、正文、发布日期、作者等信息
   */
  @Column({ type: 'jsonb', nullable: true })
  crawlResult: {
    title: string
    content: string
    publishDate?: string
    author?: string
    url: string
  } | null

  /**
   * 关联的 RawContent ID
   * 采集成功后创建
   */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  rawContentId: string | null

  /**
   * 当前重试次数
   */
  @Column({ type: 'int', default: 0 })
  retryCount: number

  /**
   * 失败错误信息
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null

  /**
   * 任务开始时间
   */
  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null

  /**
   * 任务完成时间
   */
  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @DeleteDateColumn()
  deletedAt: Date | null
}
