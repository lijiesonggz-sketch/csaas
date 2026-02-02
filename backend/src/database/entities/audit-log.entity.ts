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

  @Column({ name: 'userId', type: 'uuid' })
  userId: string

  @Column({ name: 'organizationId', type: 'uuid', nullable: true })
  organizationId: string | null

  @Column({ name: 'tenantId', type: 'uuid', nullable: true })
  tenantId: string | null

  @Column({
    name: 'action',
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction

  @Column({ name: 'entityType', type: 'varchar', length: 50 })
  entityType: string // e.g., 'compliance_playbook', 'checklist_submission', 'RadarPush', 'Organization'

  @Column({ name: 'entityId', type: 'uuid', nullable: true })
  entityId: string | null // ID of the entity being acted upon

  @Column({ name: 'changes', type: 'jsonb', nullable: true })
  changes: Record<string, any> | null // 变更内容（用于 UPDATE 操作）

  @Column({ name: 'details', type: 'jsonb', nullable: true })
  details: Record<string, any> | null // Additional details about the action

  @Column({ name: 'ipAddress', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null // IP address of the user (IPv4/IPv6)

  @Column({ name: 'userAgent', type: 'text', nullable: true })
  userAgent: string | null // Browser/client information

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date
}
