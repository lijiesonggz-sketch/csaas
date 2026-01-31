import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

/**
 * CrawlerLog Entity - 爬虫日志表
 *
 * 监控爬虫任务执行情况
 *
 * 用途：
 * 1. 记录每次爬虫任务的执行结果
 * 2. 监控爬虫成功率和失败原因
 * 3. 统计采集的内容数量
 * 4. 追踪重试次数
 *
 * 监控指标：
 * - 成功率 = 成功次数 / 总次数
 * - 平均采集数量 = 总采集数 / 成功次数
 * - 失败率 = 失败次数 / 总次数
 *
 * Story 2.1: 爬虫和文件导入机制
 */
@Entity('crawler_logs')
@Index(['source', 'status'])
@Index(['crawledAt'])
export class CrawlerLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 关联的原始内容ID（Story 4.1新增）
   * 用于追踪爬虫任务产生的具体内容
   */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  contentId: string | null

  /**
   * 信息源
   * 例如：'gartner', 'infoq', '信通院', 'idc'
   */
  @Column({ type: 'varchar', length: 100 })
  @Index()
  source: string

  /**
   * 内容分类
   * - tech: 技术雷达
   * - industry: 行业雷达
   * - compliance: 合规雷达
   */
  @Column({ type: 'enum', enum: ['tech', 'industry', 'compliance'] })
  category: 'tech' | 'industry' | 'compliance'

  /**
   * 目标URL
   */
  @Column({ type: 'varchar', length: 1000 })
  url: string

  /**
   * 执行状态
   * - success: 成功
   * - failed: 失败
   */
  @Column({ type: 'enum', enum: ['success', 'failed'] })
  status: 'success' | 'failed'

  /**
   * 采集的内容数量
   * 成功时记录采集了多少条内容
   */
  @Column({ type: 'int', default: 0 })
  itemsCollected: number

  /**
   * 错误消息
   * 失败时记录错误原因
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null

  /**
   * 爬取耗时（Story 4.1新增）
   * 单位：毫秒
   */
  @Column({ type: 'int', default: 0 })
  crawlDuration: number

  /**
   * 重试次数
   * 记录这次任务重试了多少次
   */
  @Column({ type: 'int', default: 0 })
  retryCount: number

  /**
   * 爬取时间（Story 4.1修复：重命名executedAt为crawledAt）
   */
  @Column({ type: 'timestamp' })
  @Index()
  crawledAt: Date

  @CreateDateColumn()
  createdAt: Date
}
