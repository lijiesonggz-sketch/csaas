import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TenantEntity } from '../interfaces/tenant-entity.interface'

export const ADVISORY_ORGANIZATION_CONTEXT_ENTERPRISE_BACKGROUND = 'enterprise_background'

export interface AdvisoryOrganizationContextData {
  organizationName: string
  industry: string | null
  size: string | null
}

export interface AdvisoryOrganizationContextCompletenessMetadata {
  requiredFieldsComplete: boolean
  suppliedFields: string[]
  missingFields: string[]
  updatedAt: string
}

@Entity('organization_context')
@Index('idx_organization_context_tenant_id', ['tenantId'])
@Index('idx_organization_context_tenant_context', ['tenantId', 'contextType'], {
  unique: true,
})
export class AdvisoryOrganizationContext implements TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string

  @Column({ name: 'context_type', type: 'varchar', length: 80 })
  contextType: string

  @Column({ name: 'context_data', type: 'jsonb', default: () => "'{}'::jsonb" })
  contextData: AdvisoryOrganizationContextData

  @Column({ name: 'completeness_score', type: 'real', default: 0 })
  completenessScore: number

  @Column({ name: 'completeness_metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  completenessMetadata: AdvisoryOrganizationContextCompletenessMetadata

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
