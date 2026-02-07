import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * SystemHealthLog Entity
 *
 * Stores system health metrics over time for monitoring and trend analysis.
 * Platform-level entity (no tenantId) - tracks overall system health.
 *
 * @entity system_health_logs
 * @story 7-1
 * @module backend/src/database/entities
 */
@Entity('system_health_logs')
@Index(['metricType', 'recordedAt'])
@Index(['status', 'recordedAt'])
export class SystemHealthLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'metric_type',
    type: 'varchar',
    length: 50,
  })
  @Index()
  metricType: 'availability' | 'push_success_rate' | 'ai_cost' | 'customer_activity';

  @Column('decimal', { precision: 10, scale: 2, name: 'metric_value' })
  metricValue: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'target_value',
  })
  targetValue: number;

  @Column({
    type: 'varchar',
    length: 20,
  })
  status: 'healthy' | 'warning' | 'critical';

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'recorded_at' })
  @Index()
  recordedAt: Date;
}
