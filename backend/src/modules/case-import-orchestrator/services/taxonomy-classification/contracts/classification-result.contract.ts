export const TAXONOMY_PATH_DECISIONS = [
  'PRIMARY_CHAIN',
  'LEGACY_FALLBACK',
  'ABSTAIN',
  'UNCLASSIFIED',
] as const

export type TaxonomyPathDecision = (typeof TAXONOMY_PATH_DECISIONS)[number]

export const TAXONOMY_FAILURE_SEMANTICS = [
  'LOW_CONFIDENCE',
  'NO_MATCH',
  'MAPPING_MISSING',
  'ENGINE_ERROR',
  'UNSUPPORTED_DOMAIN',
] as const

export type TaxonomyFailureSemantic = (typeof TAXONOMY_FAILURE_SEMANTICS)[number]

export type TaxonomyDecisionSource = 'rule' | 'semantic' | 'none'

export type TaxonomyClassificationInput = {
  rawText: string
  caseFacts?: string | null
  penaltyReason?: string | null
}

export type NormalizedTaxonomyClassificationInput = TaxonomyClassificationInput & {
  mergedText: string
  normalizedText: string
  normalizedTokens: string[]
  normalizedPhrases: string[]
}

export type TaxonomyMappingRecord = {
  l1Code: string
  l1Name: string
  l2Code: string
  l2Name: string
  definition: string
  canonicalTheme: string
  aliases: string[]
  keywords: string[]
}

export type TaxonomyRuleSignal = {
  label: string
  pattern: RegExp
  weight: number
}

export type TaxonomyRulebookEntry = {
  l2Code: string
  signals: TaxonomyRuleSignal[]
}

export type TaxonomyRulebook = {
  l1Code: string
  version: string
  fallbackBucket?: string | null
  entries: TaxonomyRulebookEntry[]
}

export type TaxonomyScoreGapStrategy = 'default'

export type TaxonomyGatePolicy = 'requires-domain-rollout-policy'

export type TaxonomyFallbackPolicy = 'legacy-fallback-when-rollout-enabled'

export const TAXONOMY_DOMAIN_READINESS_STAGES = [
  'seed-ready',
  'runtime-classifier-ready',
  'shadow-ready',
  'primary-ready',
] as const

export type TaxonomyDomainReadinessStage =
  (typeof TAXONOMY_DOMAIN_READINESS_STAGES)[number]

export type TaxonomyDomainReadiness = {
  stage: TaxonomyDomainReadinessStage
  verifiableEntryPoint: string
}

export type TaxonomyDomainProfile = {
  l1Code: string
  fallbackBucket: string
  primaryThreshold: number
  semanticThreshold: number
  minimumScoreGap: number
  minimumPhraseHits: number
  scoreGapStrategy: TaxonomyScoreGapStrategy
  gatePolicy: TaxonomyGatePolicy
  fallbackPolicy: TaxonomyFallbackPolicy
  rulebookVersion: string
}

export type TaxonomyDomainRegistryEntry = {
  profile: TaxonomyDomainProfile
  rulebook: TaxonomyRulebook
  readiness: TaxonomyDomainReadiness
}

export type TaxonomyClassificationResult = {
  l1Code: string | null
  l2Code: string | null
  l2Name: string | null
  score: number
  confidenceScore: number
  scoreGap: number
  decisionSource: TaxonomyDecisionSource
  matchedSignals: string[]
  matchedPhrases: string[]
  matchedTokens: string[]
  classifierVersion: string
  mappingVersion: string
  rulebookVersion: string
  classifiedAt: string
  pathDecision: TaxonomyPathDecision
  failureSemantics: TaxonomyFailureSemantic | null
}

export type TaxonomyClassificationRequest = TaxonomyClassificationInput & {
  preferredL1Code?: string | null
}

export type TaxonomyClassifierEngineArgs = {
  input: NormalizedTaxonomyClassificationInput
  mappings: TaxonomyMappingRecord[]
  rulebook?: TaxonomyRulebook | null
  activeProfile: TaxonomyDomainProfile
  classifierVersion: string
  mappingVersion: string
  classifiedAt: string
}
