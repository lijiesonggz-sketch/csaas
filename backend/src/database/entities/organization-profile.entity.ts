import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'
import {
  OrgProfileAssetBucket,
  OrgProfileCiioStatus,
  OrgProfileCriticalSystemLevel,
  OrgProfileImportantDataStatus,
  OrgProfileIndustry,
  OrgProfileLegalPersonType,
  OrgProfileOutsourcingLevel,
  OrgProfilePublicServiceScope,
  OrgProfileRegulatoryAttentionLevel,
} from '../../constants/org-profile-enums'
import { Organization } from './organization.entity'

@Entity('organization_profiles')
export class OrganizationProfile {
  @PrimaryColumn('uuid', { name: 'org_id' })
  orgId: string

  @OneToOne(() => Organization, (organization) => organization.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization

  @Column({ type: 'varchar', length: 50 })
  industry: OrgProfileIndustry

  @Column({ name: 'legal_person_type', type: 'varchar', length: 50 })
  legalPersonType: OrgProfileLegalPersonType

  @Column({ name: 'asset_bucket', type: 'varchar', length: 30 })
  assetBucket: OrgProfileAssetBucket

  @Column({ name: 'has_personal_info', type: 'boolean', default: true })
  hasPersonalInfo: boolean

  @Column({ name: 'cross_border_data', type: 'boolean', default: false })
  crossBorderData: boolean

  @Column({ name: 'important_data_status', type: 'varchar', length: 50, default: 'unknown' })
  importantDataStatus: OrgProfileImportantDataStatus

  @Column({ name: 'ciio_status', type: 'varchar', length: 50, default: 'unknown' })
  ciioStatus: OrgProfileCiioStatus

  @Column({ name: 'has_datacenter', type: 'boolean', default: false })
  hasDatacenter: boolean

  @Column({ name: 'uses_cloud', type: 'boolean', default: false })
  usesCloud: boolean

  @Column({ name: 'outsourcing_level', type: 'varchar', length: 30, default: 'none' })
  outsourcingLevel: OrgProfileOutsourcingLevel

  @Column({
    name: 'critical_system_level',
    type: 'varchar',
    length: 30,
    default: 'medium',
  })
  criticalSystemLevel: OrgProfileCriticalSystemLevel

  @Column({ name: 'has_online_trading', type: 'boolean', default: false })
  hasOnlineTrading: boolean

  @Column({ name: 'has_ai_services', type: 'boolean', default: false })
  hasAiServices: boolean

  @Column({ name: 'public_service_scope', type: 'varchar', length: 50, default: 'none' })
  publicServiceScope: OrgProfilePublicServiceScope

  @Column({
    name: 'regulatory_attention_level',
    type: 'varchar',
    length: 50,
    default: 'low',
  })
  regulatoryAttentionLevel: OrgProfileRegulatoryAttentionLevel

  @Column({ name: 'recent_major_incident', type: 'boolean', default: false })
  recentMajorIncident: boolean

  @Column({ name: 'extended_profile', type: 'jsonb', nullable: true })
  extendedProfile?: Record<string, unknown> | null

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
