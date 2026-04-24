type ClassificationResultFixture = {
  l1Code: string | null
  l2Code: string | null
  l2Name: string | null
  score: number
  confidenceScore: number
  scoreGap: number
  decisionSource: 'rule' | 'semantic' | 'hybrid' | 'none'
  matchedSignals: string[]
  matchedPhrases: string[]
  matchedTokens: string[]
  classifierVersion: string
  mappingVersion: string
  rulebookVersion: string
  classifiedAt: string
  pathDecision: 'PRIMARY_CHAIN' | 'LEGACY_FALLBACK' | 'ABSTAIN' | 'UNCLASSIFIED'
  failureSemantics:
    | 'LOW_CONFIDENCE'
    | 'NO_MATCH'
    | 'MAPPING_MISSING'
    | 'ENGINE_ERROR'
    | 'LEGACY_FALLBACK_TRIGGERED'
    | 'PENDING_RECLASSIFY'
    | 'UNSUPPORTED_DOMAIN'
    | null
}

const BASE_CLASSIFIER_VERSION = 'taxonomy-classifier-6.3'
const BASE_MAPPING_VERSION = '2026-04-07'
const BASE_CLASSIFIED_AT = '2026-04-24T23:40:00.000+08:00'

function createPrimaryResult(args: {
  l1Code: string
  l2Code: string
  l2Name: string
  score: number
  confidenceScore: number
  scoreGap: number
  rulebookVersion: string
}): ClassificationResultFixture {
  return {
    l1Code: args.l1Code,
    l2Code: args.l2Code,
    l2Name: args.l2Name,
    score: args.score,
    confidenceScore: args.confidenceScore,
    scoreGap: args.scoreGap,
    decisionSource: 'rule',
    matchedSignals: ['automate-signal'],
    matchedPhrases: ['automate-signal'],
    matchedTokens: ['automate'],
    classifierVersion: BASE_CLASSIFIER_VERSION,
    mappingVersion: BASE_MAPPING_VERSION,
    rulebookVersion: args.rulebookVersion,
    classifiedAt: BASE_CLASSIFIED_AT,
    pathDecision: 'PRIMARY_CHAIN',
    failureSemantics: null,
  }
}

function createTerminalResult(args: {
  l1Code: string
  rulebookVersion: string
  failureSemantics: ClassificationResultFixture['failureSemantics']
}): ClassificationResultFixture {
  return {
    l1Code: args.l1Code,
    l2Code: null,
    l2Name: null,
    score: 0,
    confidenceScore: 0,
    scoreGap: 0,
    decisionSource: 'none',
    matchedSignals: [],
    matchedPhrases: [],
    matchedTokens: [],
    classifierVersion: BASE_CLASSIFIER_VERSION,
    mappingVersion: BASE_MAPPING_VERSION,
    rulebookVersion: args.rulebookVersion,
    classifiedAt: BASE_CLASSIFIED_AT,
    pathDecision: 'UNCLASSIFIED',
    failureSemantics: args.failureSemantics,
  }
}

export const CLASSIFICATION_LEDGER_AUTOMATE_PENDING_CASE = {
  caseId: 'case-6-3-automate-001',
  importBatchId: 'batch-6-3-automate',
  status: 'pending',
  regulatorCode: 'NFRA',
  industry: 'banking',
  caseFacts: '后台运维直接改数且没有留痕，多个域都有一定命中信号。',
  penaltyReason: '分类需要在多个 runtime-ready 域之间稳定择优。',
} as const

export const CLASSIFICATION_LEDGER_AUTOMATE_EMPTY_DOMAIN_CASE = {
  ...CLASSIFICATION_LEDGER_AUTOMATE_PENDING_CASE,
  caseId: 'case-6-3-automate-empty-domain',
  importBatchId: 'batch-6-3-automate-empty-domain',
} as const

export const CLASSIFICATION_LEDGER_AUTOMATE_SCORE_GAP_ATTEMPTS: Record<
  string,
  ClassificationResultFixture
> = {
  IT03: createPrimaryResult({
    l1Code: 'IT03',
    l2Code: 'IT03-02',
    l2Name: '个人信息泄露/出售/非法提供/非法查询',
    score: 9,
    confidenceScore: 0.9,
    scoreGap: 1,
    rulebookVersion: 'it03-rulebook-v1',
  }),
  IT04: createPrimaryResult({
    l1Code: 'IT04',
    l2Code: 'IT04-10',
    l2Name: '信息登记/录入/更新不及时不规范',
    score: 9,
    confidenceScore: 0.9,
    scoreGap: 3,
    rulebookVersion: 'it04-rulebook-v1',
  }),
}

export const CLASSIFICATION_LEDGER_AUTOMATE_REGISTRY_ORDER_ATTEMPTS: Record<
  string,
  ClassificationResultFixture
> = {
  IT03: createPrimaryResult({
    l1Code: 'IT03',
    l2Code: 'IT03-03',
    l2Name: '客户信息保护管理薄弱',
    score: 8,
    confidenceScore: 0.88,
    scoreGap: 2,
    rulebookVersion: 'it03-rulebook-v1',
  }),
  IT04: createPrimaryResult({
    l1Code: 'IT04',
    l2Code: 'IT04-09',
    l2Name: '业务数据真实性/准确性/完整性问题',
    score: 8,
    confidenceScore: 0.88,
    scoreGap: 2,
    rulebookVersion: 'it04-rulebook-v1',
  }),
}

export const CLASSIFICATION_LEDGER_AUTOMATE_MAPPING_MISSING_RESULT =
  createTerminalResult({
    l1Code: 'IT04',
    rulebookVersion: 'it04-rulebook-v1',
    failureSemantics: 'MAPPING_MISSING',
  })
