export const ORG_PROFILE_INDUSTRIES = [
  'bank',
  'securities',
  'fund',
  'futures',
  'insurance',
  'mixed',
  'other',
] as const

export const ORG_PROFILE_LEGAL_PERSON_TYPES = [
  'legal_person',
  'branch',
  'group_hq',
  'subsidiary',
] as const

export const ORG_PROFILE_ASSET_BUCKETS = [
  'micro',
  'small',
  'medium',
  'large',
  'mega',
] as const

export const ORG_PROFILE_IMPORTANT_DATA_STATUSES = ['unknown', 'no', 'suspected', 'yes'] as const

export const ORG_PROFILE_CIIO_STATUSES = ['unknown', 'no', 'yes'] as const

export const ORG_PROFILE_OUTSOURCING_LEVELS = ['none', 'low', 'medium', 'high'] as const

export const ORG_PROFILE_CRITICAL_SYSTEM_LEVELS = ['low', 'medium', 'high', 'very_high'] as const

export const ORG_PROFILE_PUBLIC_SERVICE_SCOPES = [
  'none',
  'internal',
  'partner',
  'public_users',
] as const

export const ORG_PROFILE_REGULATORY_ATTENTION_LEVELS = ['low', 'medium', 'high'] as const

export type OrgProfileIndustry = (typeof ORG_PROFILE_INDUSTRIES)[number]
export type OrgProfileLegalPersonType = (typeof ORG_PROFILE_LEGAL_PERSON_TYPES)[number]
export type OrgProfileAssetBucket = (typeof ORG_PROFILE_ASSET_BUCKETS)[number]
export type OrgProfileImportantDataStatus = (typeof ORG_PROFILE_IMPORTANT_DATA_STATUSES)[number]
export type OrgProfileCiioStatus = (typeof ORG_PROFILE_CIIO_STATUSES)[number]
export type OrgProfileOutsourcingLevel = (typeof ORG_PROFILE_OUTSOURCING_LEVELS)[number]
export type OrgProfileCriticalSystemLevel = (typeof ORG_PROFILE_CRITICAL_SYSTEM_LEVELS)[number]
export type OrgProfilePublicServiceScope = (typeof ORG_PROFILE_PUBLIC_SERVICE_SCOPES)[number]
export type OrgProfileRegulatoryAttentionLevel =
  (typeof ORG_PROFILE_REGULATORY_ATTENTION_LEVELS)[number]
