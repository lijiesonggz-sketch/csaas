import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

/**
 * RawContent Entity - 原始内容表
 *
 * 存储爬虫采集或文件导入的原始内容
 *
 * 数据来源：
 * 1. 爬虫采集：GARTNER、信通院、IDC、技术媒体等
 * 2. 文件导入：微信公众号文章、内部文档等
 *
 * 内容分类：
 * - tech: 技术雷达内容（技术趋势、实施案例、ROI分析）
 * - industry: 行业雷达内容（同业案例、最佳实践）
 * - compliance: 合规雷达内容（监管政策、处罚案例）
 *
 * 处理流程：
 * 1. 爬虫/文件导入 → RawContent (status: pending)
 * 2. AI分析队列 → AnalyzedContent (status: analyzing)
 * 3. 分析完成 → AnalyzedContent (status: analyzed)
 * 4. 相关性计算 → RadarPush
 *
 * Story 2.1: 爬虫和文件导入机制
 */
@Entity('raw_contents')
@Index(['status', 'category'])
@Index(['contentHash'])
@Index(['organizationId', 'category'])
export class RawContent {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 内容来源
   * 例如：'gartner', 'infoq', '信通院', 'wechat', 'manual-import'
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
   * 文章标题
   */
  @Column({ type: 'varchar', length: 500 })
  title: string

  /**
   * 文章摘要
   */
  @Column({ type: 'text', nullable: true })
  summary: string | null

  /**
   * 文章正文
   */
  @Column({ type: 'text' })
  fullContent: string

  /**
   * 原文URL
   */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  url: string | null

  /**
   * 发布日期
   */
  @Column({ type: 'timestamp', nullable: true })
  publishDate: Date | null

  /**
   * 作者
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  author: string | null

  /**
   * 内容哈希（用于去重）
   * 使用SHA-256哈希（title + url + publishDate）
   */
  @Column({ type: 'varchar', length: 64, unique: true })
  contentHash: string

  /**
   * 处理状态
   * - pending: 待分析
   * - analyzing: 分析中
   * - analyzed: 已分析
   * - failed: 分析失败
   */
  @Column({
    type: 'enum',
    enum: ['pending', 'analyzing', 'analyzed', 'failed'],
    default: 'pending',
  })
  status: 'pending' | 'analyzing' | 'analyzed' | 'failed'

  /**
   * 组织ID
   * - null: 公共内容（对所有组织可见）
   * - uuid: 私有内容（仅对该组织可见）
   *
   * 例如：
   * - GARTNER报告：organizationId = null（公共）
   * - 某组织导入的内部文档：organizationId = 该组织ID（私有）
   */
  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null

  /**
   * 内容类型（Story 3.1新增）
   * 用于区分文章、招聘信息、会议内容
   */
  @Column({
    type: 'enum',
    enum: ['article', 'recruitment', 'conference'],
    nullable: true,
  })
  contentType?: 'article' | 'recruitment' | 'conference'

  /**
   * 同业机构名称（Story 3.1新增）
   * 用于行业雷达的同业匹配
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  peerName?: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
