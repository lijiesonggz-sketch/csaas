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

/**
 * Tag Entity - 统一标签系统
 *
 * 支持多种标签类型：
 * - tech: 技术领域标签（云原生、AI应用、Kubernetes等）
 * - peer: 同业机构标签（杭州银行、招商银行等）
 * - compliance: 合规标签（数据安全法、GDPR等）
 * - vendor: 供应商标签（阿里云、华为等）
 * - custom: 自定义标签
 *
 * 特性：
 * - 动态增长：AI自动提取并创建新标签
 * - 层级结构：支持父子标签关系
 * - 别名支持：支持标签别名（如K8s = Kubernetes）
 * - 元数据丰富：每种标签类型有专属的metadata字段
 *
 * Story 2.1, 2.2: AI分析内容时自动提取并创建标签
 * Story 1.4: 用户引导时选择或创建标签
 */
@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * 标签名称
   * 例如：'云原生', 'Kubernetes', '杭州银行', '招商银行'
   */
  @Column({ type: 'varchar', length: 200, unique: true })
  @Index()
  name: string

  /**
   * 标签类型
   * - tech: 技术领域
   * - peer: 同业机构
   * - compliance: 合规
   * - vendor: 供应商
   * - custom: 自定义
   */
  @Column({
    type: 'enum',
    enum: ['tech', 'peer', 'compliance', 'vendor', 'custom'],
  })
  @Index()
  tagType: 'tech' | 'peer' | 'compliance' | 'vendor' | 'custom'

  /**
   * 标签分类（更细粒度）
   * 技术标签：'cloud-native', 'ai', 'security', 'devops'
   * 同业标签：'city-bank', 'national-bank', 'rural-bank'
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  category: string | null

  /**
   * 父标签ID（支持层级结构）
   * 例如：Kubernetes的父标签是"云原生"
   */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  parentTagId: string | null

  @ManyToOne(() => Tag, { nullable: true })
  @JoinColumn({ name: 'parentTagId' })
  parentTag: Tag | null

  /**
   * 标签描述
   */
  @Column({ type: 'text', nullable: true })
  description: string | null

  /**
   * 标签别名
   * 例如：['K8s', 'k8s'] 是 'Kubernetes' 的别名
   *      ['杭银'] 是 '杭州银行' 的别名
   */
  @Column({ type: 'jsonb', nullable: true })
  aliases: string[] | null

  /**
   * 标签元数据（根据tagType不同，存储不同的元数据）
   *
   * 技术标签元数据：
   * {
   *   techDomain: 'infrastructure' | 'application' | 'security',
   *   maturityLevel: 'emerging' | 'mainstream' | 'legacy'
   * }
   *
   * 同业机构元数据：
   * {
   *   institutionType: 'city-bank' | 'national-bank' | 'rural-bank',
   *   region: '浙江' | '江苏' | '全国',
   *   assetScale: '1000亿以下' | '1000-5000亿' | '5000亿以上',
   *   officialWebsite: 'https://...',
   *   logoUrl: 'https://...'
   * }
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null

  /**
   * 使用计数（被多少内容使用）
   */
  @Column({ type: 'int', default: 0 })
  @Index()
  usageCount: number

  /**
   * 关注计数（被多少组织关注）
   */
  @Column({ type: 'int', default: 0 })
  @Index()
  watchCount: number

  /**
   * 标签状态
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean

  /**
   * 是否经过人工审核
   * AI自动创建的标签默认为false，需要人工审核后设为true
   */
  @Column({ type: 'boolean', default: false })
  isVerified: boolean

  /**
   * 是否为官方标签（预设标签）
   * 系统初始化时创建的标签为true
   */
  @Column({ type: 'boolean', default: false })
  isOfficial: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
