/**
 * Organization type definitions for Radar Service
 *
 * Story 1.1 - System automatically creates organization and associates projects
 * Phase 3 - Task 3.1: Update TypeScript type definitions
 */

/**
 * Organization entity
 * Represents a user's organization for multi-tenant Radar Service
 */
export interface Organization {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  memberCount?: number
}

/**
 * Organization Member entity
 * Represents a user's membership in an organization
 */
export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: 'admin' | 'member'
  createdAt: string
  organization?: Organization
  user?: UserBasicInfo
}

/**
 * User basic info (for OrganizationMember)
 */
export interface UserBasicInfo {
  id: string
  name: string
  email: string
}

export type OrganizationProfileIndustry =
  | 'bank'
  | 'securities'
  | 'fund'
  | 'futures'
  | 'insurance'
  | 'mixed'
  | 'other'

export type OrganizationProfileLegalPersonType =
  | 'legal_person'
  | 'branch'
  | 'group_hq'
  | 'subsidiary'

export type OrganizationProfileAssetBucket =
  | 'micro'
  | 'small'
  | 'medium'
  | 'large'
  | 'mega'

export type OrganizationProfileImportantDataStatus =
  | 'unknown'
  | 'no'
  | 'suspected'
  | 'yes'

export type OrganizationProfileCiioStatus = 'unknown' | 'no' | 'yes'
export type OrganizationProfileOutsourcingLevel = 'none' | 'low' | 'medium' | 'high'
export type OrganizationProfileCriticalSystemLevel = 'low' | 'medium' | 'high' | 'very_high'
export type OrganizationProfilePublicServiceScope =
  | 'none'
  | 'internal'
  | 'partner'
  | 'public_users'
export type OrganizationProfileRegulatoryAttentionLevel = 'low' | 'medium' | 'high'

export interface OrganizationProfile {
  orgId: string
  industry: OrganizationProfileIndustry
  legalPersonType: OrganizationProfileLegalPersonType
  assetBucket: OrganizationProfileAssetBucket
  hasPersonalInfo: boolean
  crossBorderData: boolean
  importantDataStatus: OrganizationProfileImportantDataStatus
  ciioStatus: OrganizationProfileCiioStatus
  hasDatacenter: boolean
  usesCloud: boolean
  outsourcingLevel: OrganizationProfileOutsourcingLevel
  criticalSystemLevel: OrganizationProfileCriticalSystemLevel
  hasOnlineTrading: boolean
  hasAiServices: boolean
  publicServiceScope: OrganizationProfilePublicServiceScope
  regulatoryAttentionLevel: OrganizationProfileRegulatoryAttentionLevel
  recentMajorIncident: boolean
  extendedProfile?: Record<string, unknown> | null
  updatedAt: string
}

export interface UpsertOrganizationProfilePayload {
  industry: OrganizationProfileIndustry
  legalPersonType: OrganizationProfileLegalPersonType
  assetBucket: OrganizationProfileAssetBucket
  hasPersonalInfo: boolean
  crossBorderData: boolean
  importantDataStatus: OrganizationProfileImportantDataStatus
  ciioStatus: OrganizationProfileCiioStatus
  hasDatacenter: boolean
  usesCloud: boolean
  outsourcingLevel: OrganizationProfileOutsourcingLevel
  criticalSystemLevel: OrganizationProfileCriticalSystemLevel
  hasOnlineTrading: boolean
  hasAiServices: boolean
  publicServiceScope: OrganizationProfilePublicServiceScope
  regulatoryAttentionLevel: OrganizationProfileRegulatoryAttentionLevel
  recentMajorIncident: boolean
  extendedProfile?: Record<string, unknown> | null
  expectedUpdatedAt?: string
}

export interface OrganizationProfileOption<T extends string> {
  value: T
  label: string
}

export const ORGANIZATION_PROFILE_INDUSTRY_OPTIONS: OrganizationProfileOption<OrganizationProfileIndustry>[] = [
  { value: 'bank', label: '银行' },
  { value: 'securities', label: '证券' },
  { value: 'fund', label: '基金' },
  { value: 'futures', label: '期货' },
  { value: 'insurance', label: '保险' },
  { value: 'mixed', label: '综合金融' },
  { value: 'other', label: '其他' },
]

export const ORGANIZATION_PROFILE_LEGAL_PERSON_TYPE_OPTIONS: OrganizationProfileOption<OrganizationProfileLegalPersonType>[] =
  [
    { value: 'legal_person', label: '法人主体' },
    { value: 'branch', label: '分支机构' },
    { value: 'group_hq', label: '集团总部' },
    { value: 'subsidiary', label: '子公司' },
  ]

export const ORGANIZATION_PROFILE_ASSET_BUCKET_OPTIONS: OrganizationProfileOption<OrganizationProfileAssetBucket>[] =
  [
    { value: 'micro', label: '微型' },
    { value: 'small', label: '小型' },
    { value: 'medium', label: '中型' },
    { value: 'large', label: '大型' },
    { value: 'mega', label: '超大型' },
  ]

export const ORGANIZATION_PROFILE_IMPORTANT_DATA_STATUS_OPTIONS: OrganizationProfileOption<OrganizationProfileImportantDataStatus>[] =
  [
    { value: 'unknown', label: '未识别' },
    { value: 'no', label: '否' },
    { value: 'suspected', label: '疑似' },
    { value: 'yes', label: '是' },
  ]

export const ORGANIZATION_PROFILE_CIIO_STATUS_OPTIONS: OrganizationProfileOption<OrganizationProfileCiioStatus>[] =
  [
    { value: 'unknown', label: '未识别' },
    { value: 'no', label: '否' },
    { value: 'yes', label: '是' },
  ]

export const ORGANIZATION_PROFILE_OUTSOURCING_LEVEL_OPTIONS: OrganizationProfileOption<OrganizationProfileOutsourcingLevel>[] =
  [
    { value: 'none', label: '无' },
    { value: 'low', label: '低' },
    { value: 'medium', label: '中' },
    { value: 'high', label: '高' },
  ]

export const ORGANIZATION_PROFILE_CRITICAL_SYSTEM_LEVEL_OPTIONS: OrganizationProfileOption<OrganizationProfileCriticalSystemLevel>[] =
  [
    { value: 'low', label: '低' },
    { value: 'medium', label: '中' },
    { value: 'high', label: '高' },
    { value: 'very_high', label: '极高' },
  ]

export const ORGANIZATION_PROFILE_PUBLIC_SERVICE_SCOPE_OPTIONS: OrganizationProfileOption<OrganizationProfilePublicServiceScope>[] =
  [
    { value: 'none', label: '无' },
    { value: 'internal', label: '仅内部' },
    { value: 'partner', label: '合作方' },
    { value: 'public_users', label: '公众用户' },
  ]

export const ORGANIZATION_PROFILE_REGULATORY_ATTENTION_LEVEL_OPTIONS: OrganizationProfileOption<OrganizationProfileRegulatoryAttentionLevel>[] =
  [
    { value: 'low', label: '低' },
    { value: 'medium', label: '中' },
    { value: 'high', label: '高' },
  ]

/**
 * Weakness Snapshot entity
 * Represents a weakness identified during assessment
 */
export interface WeaknessSnapshot {
  id: string
  organizationId: string
  projectId: string
  category: string
  level: number
  description: string
  projectIds: string[]
  createdAt: string
}

/**
 * Aggregated Weakness
 * Result of aggregating weaknesses by category
 */
export interface AggregatedWeakness {
  category: string
  level: number
  description: string
  projectIds: string[]
}

/**
 * Paginated response wrapper
 * Standard response format for paginated data
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Organization Statistics
 * Statistical information about an organization
 */
export interface OrganizationStats {
  id: string
  memberCount: number
  projectCount: number
  weaknessSnapshotCount: number
}

/**
 * Create Organization DTO
 */
export interface CreateOrganizationDto {
  name: string
}

/**
 * Update Organization DTO
 */
export interface UpdateOrganizationDto {
  name?: string
}

/**
 * Add Organization Member DTO
 */
export interface AddMemberDto {
  userId: string
  role?: 'admin' | 'member'
}

/**
 * Link Project to Organization DTO
 */
export interface LinkProjectDto {
  projectId: string
}
