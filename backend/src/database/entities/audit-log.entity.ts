import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

/**
 * AuditAction - 审计操作类型枚举
 */
export enum AuditAction {
  PLAYBOOK_VIEW = 'playbook_view',
  CHECKLIST_SUBMIT = 'checklist_submit',
  CHECKLIST_UPDATE = 'checklist_update',
  PUSH_SENT = 'push_sent',
  PUSH_FAILED = 'push_failed',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  READ = 'read',
  ACCESS_DENIED = 'access_denied',
}

/**
 * AuditLog Entity - 审计日志实体
 *
 * Story 4.2 - NFR10: 审计日志
 * Story 6.1B - Layer 4: 审计层操作日志
 *
 * 记录所有敏感操作事件，包括：
 * - Playbook查看事件
 * - Checklist提交事件
 * - 数据访问事件
 * - 多租户敏感操作（创建/更新/删除）
 *
 * 日志保留1年，不可篡改（通过数据库触发器保护）
 */
@Entity('audit_logs')
@Index(['userId'])
@Index(['tenantId'])
@Index(['entityType'])
@Index(['entityId'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null

  @Column({
    name: 'action',
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction

  @Column({ name: 'entity_type', type: 'varchar', length: 50 })
  entityType: string

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null

  @Column({ name: 'changes', type: 'jsonb', nullable: true })
  changes: Record<string, any> | null

  @Column({ name: 'details', type: 'jsonb', nullable: true })
  details: Record<string, any> | null

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
