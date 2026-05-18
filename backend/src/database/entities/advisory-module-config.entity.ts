import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import { UserRole } from './user.entity'

@Entity('advisory_module_configs')
@Unique('UQ_advisory_module_configs_tenant_module', ['tenantId', 'moduleKey'])
@Index('idx_advisory_module_configs_tenant_id', ['tenantId'])
@Index('idx_advisory_module_configs_module_key', ['moduleKey'])
export class AdvisoryModuleConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string

  @Column({ name: 'module_key', type: 'varchar', length: 50, default: 'thinktank' })
  moduleKey: string

  @Column({ name: 'enabled', type: 'boolean', default: false })
  enabled: boolean

  @Column({
    name: 'allowed_roles',
    type: 'text',
    array: true,
    default: () => "'{}'::text[]",
  })
  allowedRoles: UserRole[]

  @Column({ name: 'data_retention_days', type: 'integer', default: 90 })
  dataRetentionDays: number

  @Column({ name: 'privacy_confirmed_at', type: 'timestamptz', nullable: true })
  privacyConfirmedAt: Date | null

  @Column({ name: 'privacy_confirmed_by', type: 'uuid', nullable: true })
  privacyConfirmedBy: string | null

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
