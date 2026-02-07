import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Alert Entity
 *
 * Stores system alerts for monitoring and notification.
 * Platform-level entity (no tenantId) - tracks system-wide alerts.
 *
 * @entity alerts
 * @story 7-1
 * @module backend/src/database/entities
 */
@Entity('alerts')
@Index(['status', 'occurredAt'])
@Index(['severity', 'occurredAt'])
@Index(['alertType', 'occurredAt'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'alert_type',
    type: 'varchar',
    length: 50,
  })
  alertType:
    | 'crawler_failure'
    | 'ai_cost_exceeded'
    | 'customer_churn_risk'
    | 'push_failure_high'
    | 'system_downtime';

  @Column({
    type: 'varchar',
    length: 20,
  })
  severity: 'high' | 'medium' | 'low';

  @Column('text')
  message: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'unresolved',
  })
  @Index()
  status: 'unresolved' | 'resolved' | 'ignored';

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'occurred_at' })
  @Index()
  occurredAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string;
}
