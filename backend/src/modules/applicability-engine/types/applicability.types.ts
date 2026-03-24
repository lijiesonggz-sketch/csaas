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
export const RULE_LOGICAL_OPERATORS = ['all', 'any', 'not'] as const
export type RuleLogicalOperator = (typeof RULE_LOGICAL_OPERATORS)[number]

export interface RuleCondition {
  field: string
  op: RuleOperator
  value?: boolean | number | string | string[]
}

export type PredicateNode = RuleCondition | RulePredicate

type PredicateBranch<Operator extends RuleLogicalOperator> = {
  [Key in Operator]: PredicateNode[]
} & Partial<Record<Exclude<RuleLogicalOperator, Operator>, never>>

export type RulePredicate = PredicateBranch<'all'> | PredicateBranch<'any'> | PredicateBranch<'not'>

export interface RuleTraceEntry {
  field: string
  op: RuleOperator
  expectedValue?: boolean | number | string | string[]
  actualValue: unknown
  matched: boolean
  logicalPath: RuleLogicalOperator[]
}

export interface PredicateEvaluationResult {
  matched: boolean
  traceEntries: RuleTraceEntry[]
}

export interface RuleResult {
  priority?: 'LOW' | 'MEDIUM' | 'HIGH'
  mandatory?: boolean
  questionPackCodes?: string[]
  evidencePackCodes?: string[]
  remediationPackCodes?: string[]
  reasonTemplate?: string
}

export const RESOLUTION_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
export type ResolutionPriority = (typeof RESOLUTION_PRIORITIES)[number]

export const RESOLVER_RULE_TARGET_TYPES = ['pack', 'control'] as const
export type ResolverRuleTargetType = (typeof RESOLVER_RULE_TARGET_TYPES)[number]

export const RESOLVER_RULE_TYPES = ['include', 'exclude', 'strengthen', 'recommend'] as const
export type ResolverRuleType = (typeof RESOLVER_RULE_TYPES)[number]

export interface AppliedEffect {
  addedPackCodes: string[]
  addedControlCodes: string[]
  strengthenedControlCodes: string[]
  excludedControlCodes: string[]
  noOpReason?: string
}

export interface PackResolutionDebugEntry {
  ruleCode: string
  targetType: ResolverRuleTargetType
  targetCode: string
  ruleType: ResolverRuleType
  matched: boolean
  traceEntries: RuleTraceEntry[]
  appliedEffect: AppliedEffect
}

export interface ResolvedControl {
  controlId: string
  controlCode: string
  controlName: string
  controlFamily: string
  mandatory: boolean
  priority: ResolutionPriority
  matchedPacks: string[]
  matchedRules: string[]
  reasons: string[]
  questionPackCodes: string[]
  evidencePackCodes: string[]
  remediationPackCodes: string[]
}

export interface ResolvedControlSummary {
  totalControls: number
  mandatoryCount: number
  matchedPacks: number
  matchedRules: number
  excludedControls: number
}

export interface ResolvedControlSet {
  matchedPacks: string[]
  matchedRules: string[]
  controls: ResolvedControl[]
  summary: ResolvedControlSummary
  debugLog: PackResolutionDebugEntry[]
}

export interface MatchedRuleSnapshot {
  ruleCode: string
  targetType: ResolverRuleTargetType
  targetCode: string
  ruleType: ResolverRuleType
  priority: number
  result?: RuleResult
}

export interface ResolverControlCatalogRecord {
  controlId: string
  controlCode: string
  controlName: string
  controlFamily: string
  mandatoryDefault: boolean
  priorityDefault: ResolutionPriority
  questionPackCodes: string[]
  evidencePackCodes: string[]
  remediationPackCodes: string[]
}

export interface ResolverControlRuleRecord {
  ruleCode: string
  targetType: ResolverRuleTargetType
  targetCode: string
  ruleType: ResolverRuleType
  priority: number
  predicate: RulePredicate
  result?: RuleResult
  effectiveFrom?: string | null
  effectiveTo?: string | null
  status?: string
}

export interface ResolverControlAssertionRecord {
  profileCode: string
  mustContainControlCodes: string[]
  mustHaveMandatoryControlCodes: string[]
  mustHaveHighPriorityControlCodes: string[]
  mustExcludeControlCodes: string[]
}

export interface NormalizedResolverRule {
  ruleCode: string
  targetType: ResolverRuleTargetType
  targetCode: string
  ruleType: ResolverRuleType
  priority: number
  predicate: RulePredicate
  result?: RuleResult
  effectiveFrom?: string | null
  effectiveTo?: string | null
  status?: string
  source: 'db' | 'fixture'
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
