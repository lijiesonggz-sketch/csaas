import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

/**
 * ComplianceChecklistSubmission Entity - 合规检查清单提交实体
 *
 * Story 4.2 - Phase 5: Checklist提交功能
 * AR12 Layer 3 Defense: 添加organizationId字段用于PostgreSQL RLS策略
 *
 * 多租户隔离：
 * - Layer 1 (API): JwtAuthGuard + @CurrentUser()
 * - Layer 2 (Service): validatePushAccess() 验证push.organizationId
 * - Layer 3 (Database): PostgreSQL RLS基于organizationId过滤行
 * - Layer 4 (Audit): AuditLog记录所有敏感操作
 */
@Entity('compliance_checklist_submissions')
@Index(['pushId', 'userId']) // ✅ 复合索引用于幂等性检查
@Index(['organizationId']) // AR12 Layer 3: RLS索引
export class ComplianceChecklistSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pushId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ name: 'organizationId', type: 'uuid', nullable: true }) // AR12 Layer 3: 组织ID
  organizationId: string | null;

  @Column({ type: 'json' })
  checkedItems: string[];

  @Column({ type: 'json' })
  uncheckedItems: string[];

  @Column({ type: 'text', nullable: true })
  notes: string; // Story 4.2 - Phase 5: 用户附加备注

  @CreateDateColumn({ name: 'submittedAt' })
  submittedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date; // ✅ 支持重复提交更新
}
