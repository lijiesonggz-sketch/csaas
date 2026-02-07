import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from './organization.entity';

/**
 * Customer Activity Log Entity
 *
 * Tracks daily customer activity for calculating monthly active users (MAU).
 * Uses daily aggregation (activity_date + activity_count) to reduce data volume.
 *
 * @entity customer_activity_logs
 * @story 7-3
 * @module backend/src/database/entities
 */
@Entity('customer_activity_logs')
@Index(['organizationId', 'activityDate'])
@Index(['activityType', 'createdAt'])
export class CustomerActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 50, name: 'activity_type' })
  activityType: 'login' | 'push_view' | 'feedback_submit' | 'settings_update';

  @Column({ type: 'date', name: 'activity_date' })
  activityDate: string; // YYYY-MM-DD format for daily aggregation

  @Column({ type: 'int', default: 1, name: 'activity_count' })
  activityCount: number;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
