import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm'

/**
 * CompliancePlaybook Entity - 合规剧本实体
 *
 * Story 4.2 - Phase 4: 合规剧本生成
 * AR12 Layer 3 Defense: 添加organizationId字段用于PostgreSQL RLS策略
 *
 * 多租户隔离：
 * - Layer 1 (API): JwtAuthGuard + @CurrentUser()
 * - Layer 2 (Service): validatePushAccess() 验证push.organizationId
 * - Layer 3 (Database): PostgreSQL RLS基于organizationId过滤行
 * - Layer 4 (Audit): AuditLog记录所有敏感操作
 */
@Entity('compliance_playbooks')
@Index(['pushId']) // ✅ 添加索引优化查询性能
@Index(['organizationId']) // AR12 Layer 3: RLS索引
export class CompliancePlaybook {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  pushId: string

  @Column({ name: 'organizationId', type: 'uuid', nullable: true }) // AR12 Layer 3: 组织ID
  organizationId: string | null

  @Column({ type: 'json' })
  checklistItems: Array<{
    id: string // ✅ UUID v4
    text: string
    category: string
    checked: boolean
    order: number // ✅ 新增：UI显示顺序
  }>

  @Column({ type: 'json' })
  solutions: Array<{
    name: string
    estimatedCost: number
    expectedBenefit: number
    roiScore: number // 0-10
    implementationTime: string
  }>

  @Column({ type: 'text' })
  reportTemplate: string

  @Column({ type: 'json', nullable: true })
  policyReference: string[]

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date

  @Column({ type: 'timestamp', nullable: true })
  generatedAt: Date // ✅ 新增：实际生成时间
}
