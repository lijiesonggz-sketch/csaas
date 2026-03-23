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
} from '../../../constants/org-profile-enums'

export const RULE_OPERATORS = [
  'eq',
  'neq',
  'in',
  'not_in',
  'gt',
  'gte',
  'lt',
  'lte',
  'exists',
  'is_true',
  'is_false',
  'contains',
] as const

export type RuleOperator = (typeof RULE_OPERATORS)[number]

export interface RuleCondition {
  field: string
  op: RuleOperator
  value?: boolean | number | string | string[]
}

export type RulePredicate =
  | { all: RuleCondition[] }
  | { any: RuleCondition[] }
  | { not: RuleCondition[] }

export interface RuleResult {
  priority?: 'LOW' | 'MEDIUM' | 'HIGH'
  mandatory?: boolean
  questionPackCodes?: string[]
  evidencePackCodes?: string[]
  remediationPackCodes?: string[]
  reasonTemplate?: string
}

export interface OrgProfileSeedRecord {
  industry: OrgProfileIndustry
  legalPersonType: OrgProfileLegalPersonType
  assetBucket: OrgProfileAssetBucket
  hasPersonalInfo: boolean
  crossBorderData: boolean
  importantDataStatus: OrgProfileImportantDataStatus
  ciioStatus: OrgProfileCiioStatus
  hasDatacenter: boolean
  usesCloud: boolean
  outsourcingLevel: OrgProfileOutsourcingLevel
  criticalSystemLevel: OrgProfileCriticalSystemLevel
  hasOnlineTrading: boolean
  hasAiServices: boolean
  publicServiceScope: OrgProfilePublicServiceScope
  regulatoryAttentionLevel: OrgProfileRegulatoryAttentionLevel
  recentMajorIncident: boolean
}
