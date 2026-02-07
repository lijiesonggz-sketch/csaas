import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from './organization.entity';

/**
 * Customer Intervention Entity
 *
 * Records admin interventions for at-risk customers.
 * Tracks contact attempts, surveys, training, and configuration adjustments.
 *
 * @entity customer_interventions
 * @story 7-3
 * @module backend/src/database/entities
 */
@Entity('customer_interventions')
@Index(['organizationId', 'createdAt'])
export class CustomerIntervention {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 50, name: 'intervention_type' })
  interventionType: 'contact' | 'survey' | 'training' | 'config_adjustment';

  @Column({ type: 'varchar', length: 50 })
  result: 'contacted' | 'resolved' | 'churned' | 'pending';

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
