import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'user_id', nullable: true })
  userId: string

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction

  @Column({ name: 'entity_type', nullable: true })
  entityType: string

  @Column({ name: 'entity_id', nullable: true })
  entityId: string

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, any>

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
