import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
  Index,
} from 'typeorm'
import { RawContent } from './raw-content.entity'
import { Tag } from './tag.entity'

// 导入ROI分析数据接口 (Story 2.4 - Issue #4修复)
export interface ROIAnalysisData {
  estimatedCost: string
  expectedBenefit: string
  roiEstimate: string
  implementationPeriod: string
  recommendedVendors: string[]
}

/**
 * AnalyzedContent Entity - AI分析结果表
 *
 * 存储AI分析后的结构化数据
 *
 * AI分析内容：
 * 1. 标签提取：技术领域、同业机构、合规标签等
 * 2. 关键词提取：非结构化关键词
 * 3. 目标受众识别：IT总监、架构师、开发团队等
 * 4. AI摘要生成：简洁的内容摘要
 * 5. ROI分析：预计投入、预期收益、ROI估算等（Story 2.4）
 *
 * 标签关系：
 * - 多对多关系到Tag表（通过content_tags关联表）
 * - AI自动提取标签，如果标签不存在则自动创建
 *
 * Story 2.2: AI智能分析推送内容的相关性
 * Story 2.4: ROI分析
 */
@Entity('analyzed_contents')
@Index(['contentId'])
export class AnalyzedContent {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 关联的原始内容ID
   */
  @Column({ type: 'uuid' })
  @Index()
  contentId: string

  @ManyToOne(() => RawContent)
  @JoinColumn({ name: 'contentId' })
  rawContent: RawContent

  /**
   * 提取的标签（多对多关系）
   * AI分析时自动提取并关联标签
   *
   * 例如：
   * - 技术标签：['云原生', 'Kubernetes', 'Serverless']
   * - 同业标签：['杭州银行', '招商银行']
   * - 合规标签：['数据安全法', 'GDPR']
   */
  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'content_tags',
    joinColumn: { name: 'contentId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags: Tag[]

  /**
   * 关键词（非结构化）
   * 补充标签系统，存储一些非标准化的关键词
   */
  @Column({ type: 'jsonb' })
  keywords: string[]

  /**
   * 技术分类（多个）
   * AI分析时自动提取的技术分类
   * 例如：['云原生', '容器编排', '微服务']
   */
  @Column({ type: 'jsonb', default: '[]' })
  categories: string[]

  /**
   * 目标受众
   * 例如：'IT总监', '架构师', '开发团队', 'CTO'
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  targetAudience: string | null

  /**
   * AI生成的摘要
   * 比原始摘要更简洁、更结构化
   */
  @Column({ type: 'text', nullable: true })
  aiSummary: string | null

  /**
   * ROI分析（Story 2.4）
   * AI分析技术方案的投资回报率
   *
   * {
   *   estimatedCost: '50-100万',
   *   expectedBenefit: '年节省200万运维成本',
   *   roiEstimate: 'ROI 2:1',
   *   implementationPeriod: '3-6个月',
   *   recommendedVendors: ['阿里云', '腾讯云', '华为云']
   * }
   */
  @Column({ type: 'jsonb', nullable: true })
  roiAnalysis: ROIAnalysisData | null

  /**
   * 技术实践描述 (行业雷达 - Story 3.2)
   * AI提取的同业技术实践场景描述
   */
  @Column({ type: 'text', nullable: true })
  practiceDescription: string | null

  /**
   * 投入成本 (行业雷达 - Story 3.2)
   * AI提取的项目投入成本,如"50-100万"、"约80万"
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  estimatedCost: string | null

  /**
   * 实施周期 (行业雷达 - Story 3.2)
   * AI提取的项目实施周期,如"3-6个月"、"历时半年"
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  implementationPeriod: string | null

  /**
   * 技术效果 (行业雷达 - Story 3.2)
   * AI提取的技术实施效果,如"部署时间从2小时缩短到10分钟"
   */
  @Column({ type: 'text', nullable: true })
  technicalEffect: string | null

  /**
   * 相关性评分（0-1，Story 2.3需要）
   * AI计算的与组织薄弱项的相关性评分
   */
  @Column({ type: 'float', nullable: true })
  @Index()
  relevanceScore: number | null

  /**
   * 使用的AI模型
   * 例如：'qwen-max', 'qwen-turbo', 'gpt-4'
   */
  @Column({ type: 'varchar', length: 50 })
  aiModel: string

  /**
   * 消耗的Token数量
   * 用于成本统计和优化
   */
  @Column({ type: 'int' })
  tokensUsed: number

  /**
   * 分析状态
   * - pending: 待分析
   * - success: 分析成功
   * - failed: 分析失败
   */
  @Column({
    type: 'enum',
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
  })
  @Index()
  status: 'pending' | 'success' | 'failed'

  /**
   * 错误信息（分析失败时）
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null

  /**
   * 分析完成时间
   */
  @Column({ type: 'timestamp' })
  @Index()
  analyzedAt: Date

  @CreateDateColumn()
  createdAt: Date
}
