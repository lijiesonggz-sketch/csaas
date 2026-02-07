import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Organization } from './organization.entity';

/**
 * AI Usage Task Type Enum
 *
 * Defines the types of AI tasks that can be tracked for cost optimization.
 * Renamed from AITaskType to avoid conflict with ai-task.entity.ts
 *
 * @story 7-4
 * @module backend/src/database/entities
 */
export enum AIUsageTaskType {
  TECH_ANALYSIS = 'tech_analysis',
  INDUSTRY_ANALYSIS = 'industry_analysis',
  COMPLIANCE_ANALYSIS = 'compliance_analysis',
  ROI_CALCULATION = 'roi_calculation',
  PLAYBOOK_GENERATION = 'playbook_generation',
}

/**
 * AI Usage Log Entity
 *
 * Tracks AI API usage for cost optimization and monitoring.
 * Records token usage, cost, and task type for each AI call.
 *
 * @story 7-4
 * @module backend/src/database/entities
 */
@Entity('ai_usage_logs')
export class AIUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'task_type',
  })
  taskType: AIUsageTaskType;

  @Column({ name: 'model_name', default: 'qwen-max', length: 50 })
  modelName: string;

  @Column('int', { name: 'input_tokens', default: 0 })
  inputTokens: number;

  @Column('int', { name: 'output_tokens', default: 0 })
  outputTokens: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  cost: number;

  @Column({ name: 'request_id', nullable: true, length: 100 })
  requestId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
