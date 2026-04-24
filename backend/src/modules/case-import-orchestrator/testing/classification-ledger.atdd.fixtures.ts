const BASE_CLASSIFICATION_VERSION = 'taxonomy-classifier-6.3'
const BASE_MAPPING_VERSION = '2026-04-07'

type ClassificationResultFixture = {
  l1Code: string | null
  l2Code: string | null
  l2Name: string | null
  score: number
  confidenceScore: number
  scoreGap: number
  decisionSource: 'rule' | 'semantic' | 'none'
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
    | null
}

function createUnclassifiedResult(
  l1Code: string,
  rulebookVersion: string,
  failureSemantics: ClassificationResultFixture['failureSemantics'],
): ClassificationResultFixture {
  return {
    l1Code,
    l2Code: null,
    l2Name: null,
    score: 0,
    confidenceScore: 0,
    scoreGap: 0,
    decisionSource: 'none',
    matchedSignals: [],
    matchedPhrases: [],
    matchedTokens: [],
    classifierVersion: BASE_CLASSIFICATION_VERSION,
    mappingVersion: BASE_MAPPING_VERSION,
    rulebookVersion,
    classifiedAt: '2026-04-24T22:46:33.7654486+08:00',
    pathDecision: 'UNCLASSIFIED',
    failureSemantics,
  }
}

export const CLASSIFICATION_LEDGER_ATDD_SUPPORTED_RUNTIME_DOMAINS = [
  'IT01',
  'IT02',
  'IT03',
  'IT04',
  'IT05',
  'IT06',
  'IT07',
  'IT08',
] as const

export const CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE = {
  caseId: 'case-ledger-primary-001',
  importBatchId: 'batch-6-3-atdd-primary',
  status: 'pending',
  regulatorCode: 'NFRA',
  industry: 'banking',
  caseFacts:
    '运维人员通过后台直接修改核心业务系统数据，绕过前台控制且没有形成可审计留痕。',
  penaltyReason:
    '后台修改核心业务数据、越权操作和留痕缺失同时暴露，风险直接指向 IT07 运行控制问题。',
} as const

export const CLASSIFICATION_LEDGER_ATDD_PRIMARY_RESULTS_BY_DOMAIN: Record<
  (typeof CLASSIFICATION_LEDGER_ATDD_SUPPORTED_RUNTIME_DOMAINS)[number],
  ClassificationResultFixture
> = {
  IT01: createUnclassifiedResult('IT01', 'it01-rulebook-v1', 'NO_MATCH'),
  IT02: createUnclassifiedResult('IT02', 'it02-rulebook-v1', 'NO_MATCH'),
  IT03: createUnclassifiedResult('IT03', 'it03-rulebook-v1', 'NO_MATCH'),
  IT04: createUnclassifiedResult('IT04', 'it04-rulebook-v1', 'NO_MATCH'),
  IT05: createUnclassifiedResult('IT05', 'it05-rulebook-v1', 'NO_MATCH'),
  IT06: createUnclassifiedResult('IT06', 'it06-rulebook-v1', 'NO_MATCH'),
  IT07: {
    l1Code: 'IT07',
    l2Code: 'IT07-06',
    l2Name: '核心业务系统数据被后台修改/篡改',
    score: 9,
    confidenceScore: 0.92,
    scoreGap: 4,
    decisionSource: 'rule',
    matchedSignals: ['后台直接修改', '绕过前台控制', '缺少留痕'],
    matchedPhrases: ['后台直接修改核心业务系统数据', '绕过前台控制', '缺少有效留痕'],
    matchedTokens: ['后台', '修改', '留痕'],
    classifierVersion: BASE_CLASSIFICATION_VERSION,
    mappingVersion: BASE_MAPPING_VERSION,
    rulebookVersion: 'it07-rulebook-v1',
    classifiedAt: '2026-04-24T22:46:33.7654486+08:00',
    pathDecision: 'PRIMARY_CHAIN',
    failureSemantics: null,
  },
  IT08: createUnclassifiedResult('IT08', 'it08-rulebook-v1', 'NO_MATCH'),
}

export const CLASSIFICATION_LEDGER_ATDD_UNCLASSIFIED_RESULT =
  createUnclassifiedResult('IT04', 'it04-rulebook-v1', 'NO_MATCH')

export const CLASSIFICATION_LEDGER_ATDD_PENDING_RECLASSIFY_RESULT =
  createUnclassifiedResult('IT07', 'it07-rulebook-v1', 'PENDING_RECLASSIFY')

export const CLASSIFICATION_LEDGER_ATDD_EXPECTED_LATEST_POINTER_CASE = {
  caseId: CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE.caseId,
  previousLatestRunId: 'run-ledger-old-001',
} as const

export const CLASSIFICATION_LEDGER_ATDD_EXPECTED_LEDGER_FIELDS = [
  'classifierVersion',
  'mappingVersion',
  'rulebookVersion',
  'matchedSignals',
  'decisionTrace',
  'pathDecision',
  'classificationStatus',
  'fallbackReason',
] as const

export const CLASSIFICATION_LEDGER_ATDD_EXPECTED_PRIMARY_RUN = {
  caseId: CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE.caseId,
  batchId: CLASSIFICATION_LEDGER_ATDD_PRIMARY_CASE.importBatchId,
  classifierVersion: BASE_CLASSIFICATION_VERSION,
  mappingVersion: BASE_MAPPING_VERSION,
  rulebookVersion: 'it07-rulebook-v1',
  matchedSignals: ['后台直接修改', '绕过前台控制', '缺少留痕'],
  decisionTrace: {
    evaluatedDomains: [...CLASSIFICATION_LEDGER_ATDD_SUPPORTED_RUNTIME_DOMAINS],
    chosenDomain: 'IT07',
    chosenL2Code: 'IT07-06',
    tieBreakRule: 'confidenceScore-desc,scoreGap-desc,registry-order',
  },
  pathDecision: 'PRIMARY_CHAIN',
  classificationStatus: 'SUCCEEDED',
  fallbackReason: null,
  classificationSource: 'rule',
  classificationVersion: BASE_CLASSIFICATION_VERSION,
} as const

export const CLASSIFICATION_LEDGER_ATDD_FAILURE_SEMANTICS = [
  'LOW_CONFIDENCE',
  'NO_MATCH',
  'MAPPING_MISSING',
  'ENGINE_ERROR',
  'LEGACY_FALLBACK_TRIGGERED',
  'PENDING_RECLASSIFY',
] as const
