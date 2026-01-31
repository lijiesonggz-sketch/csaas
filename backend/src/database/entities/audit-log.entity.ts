import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

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
  ACCESS_DENIED = 'access_denied',
}

/**
 * AuditLog Entity - 审计日志实体
 *
 * Story 4.2 - NFR10: 审计日志
 *
 * 记录所有敏感操作事件，包括：
 * - Playbook查看事件
 * - Checklist提交事件
 * - 数据访问事件
 *
 * 日志保留1年，不可篡改
 */
@Entity('audit_logs')
@Index(['userId'])
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

  @Column({
    name: 'action',
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction

  @Column({ name: 'entityType', type: 'varchar', length: 50 })
  entityType: string // e.g., 'compliance_playbook', 'checklist_submission'

  @Column({ name: 'entityId', type: 'uuid' })
  entityId: string // ID of the entity being acted upon

  @Column({ name: 'details', type: 'json', nullable: true })
  details: Record<string, any> | null // Additional details about the action

  @Column({ name: 'ipAddress', type: 'varchar', nullable: true })
  ipAddress: string | null // IP address of the user (optional)

  @Column({ name: 'userAgent', type: 'varchar', nullable: true })
  userAgent: string | null // Browser/client information (optional)

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date
}
