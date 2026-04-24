import type {
  TaxonomyBenchmarkCase,
  TaxonomyBenchmarkCaseResult,
} from '../services/taxonomy-benchmark.runner'

export const TAXONOMY_BENCHMARK_AUTOMATE_REQUESTED_DOMAINS = [
  'IT04',
  'IT07',
] as const

export const TAXONOMY_BENCHMARK_AUTOMATE_REASON_CASE: TaxonomyBenchmarkCase = {
  caseId: 'IT04-AUTO-001',
  caseTitle: '链路命中但控制点缺失',
  caseText: 'EAST 数据质量自动校验规则未配置，无法落到预期控制点。',
  l1Code: 'IT04',
  tier: 'tier-1-cutover',
  riskTags: ['HIGH_RISK'],
  expectedL2Code: 'IT04-04',
  expectedFailureModeCodes: ['FM-DQ-001'],
  expectedControlCodes: ['CTRL-DQ-001'],
  expectedEvidenceCodes: ['EVD-DQ-RULE-001'],
  expectedEvidenceCategories: ['LOG'],
}

export const TAXONOMY_BENCHMARK_AUTOMATE_EMPTY_SLICE_CASE_RESULTS: TaxonomyBenchmarkCaseResult[] =
  [
    {
      caseId: 'IT04-AUTO-002',
      caseTitle: 'it04 primary',
      l1Code: 'IT04',
      tier: 'tier-0-smoke',
      riskTags: ['SMOKE'],
      expectedL2Code: 'IT04-04',
      actualL2Code: 'IT04-04',
      classificationDecisionSource: 'rule',
      classificationScoreGap: 0.2,
      pathDecision: 'PRIMARY_CHAIN',
      failureSemantic: null,
      taxonomyHit: true,
      failureModeHit: true,
      controlHit: true,
      evidenceHit: true,
      fullChainHit: true,
      missCategory: 'none',
      matchedClassifierSignals: ['EAST'],
      expectedFailureModeCodes: ['FM-DQ-001'],
      actualFailureModeCodes: ['FM-DQ-001'],
      expectedControlCodes: ['CTRL-DQ-001'],
      actualControlCodes: ['CTRL-DQ-001'],
      expectedEvidenceCodes: ['EVD-DQ-RULE-001'],
      actualEvidenceCodes: ['EVD-DQ-RULE-001'],
      expectedEvidenceCategories: ['LOG'],
      actualEvidenceCategories: ['LOG'],
      reasonSummary: 'full-chain benchmark expectations matched',
      highRiskFalseNegative: false,
      fallbackTriggered: false,
    },
  ]

export const TAXONOMY_BENCHMARK_AUTOMATE_LEGACY_RESULT = {
  l2Code: 'IT04-10',
  l2Name: '信息登记/录入/更新不及时不规范',
  score: 0.88,
  scoreGap: 0.18,
  decisionSource: 'rule',
  matchedPhrases: ['更新不及时'],
  matchedTokens: ['更新', '不及时'],
} as const

