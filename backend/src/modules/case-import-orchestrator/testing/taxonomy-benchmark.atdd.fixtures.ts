export const TAXONOMY_BENCHMARK_ATDD_FIXTURE_BASE_DIR =
  'backend/src/modules/case-import-orchestrator/testing/benchmarks'

export const TAXONOMY_BENCHMARK_ATDD_EXPECTED_TIERS = [
  'tier-0-smoke',
  'tier-1-cutover',
  'tier-2-holdout',
] as const

export const TAXONOMY_BENCHMARK_ATDD_EXPECTED_MODES = [
  'new-path',
  'legacy-path',
  'dual-path-compare',
] as const

export const TAXONOMY_BENCHMARK_ATDD_DISCOVERY_FIXTURES = [
  {
    tier: 'tier-0-smoke',
    l1Code: 'IT04',
    fixtureFile:
      'backend/src/modules/case-import-orchestrator/testing/benchmarks/tier-0-smoke/it04-reg-reporting.fixture.json',
    riskTags: ['SMOKE'],
  },
  {
    tier: 'tier-1-cutover',
    l1Code: 'IT07',
    fixtureFile:
      'backend/src/modules/case-import-orchestrator/testing/benchmarks/tier-1-cutover/it07-operations-cutover.fixture.json',
    riskTags: ['HIGH_RISK', 'HISTORICAL_FALLBACK'],
  },
  {
    tier: 'tier-2-holdout',
    l1Code: 'IT02',
    fixtureFile:
      'backend/src/modules/case-import-orchestrator/testing/benchmarks/tier-2-holdout/it02-holdout.fixture.json',
    riskTags: ['HOLDOUT', 'AMBIGUOUS_BOUNDARY'],
  },
] as const

export const TAXONOMY_BENCHMARK_ATDD_EXPECTED_REPORT_COMPATIBILITY = {
  it04MarkdownTitle: 'IT04 Benchmark Report',
  legacyReportId: 'it04-benchmark',
  unifiedReportId: 'taxonomy-benchmark',
} as const

export const TAXONOMY_BENCHMARK_ATDD_MACHINE_SUMMARY_FIELDS = [
  'generatedAt',
  'reportId',
  'mode',
  'domains',
  'tiers',
  'gateStatus',
  'metrics',
  'thresholds',
  'missingSlices',
  'compareSummary',
] as const

export const TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS = {
  taxonomyPrecision: 0.875,
  taxonomyRecall: 0.875,
  taxonomyF1: 0.875,
  failureModeHitRate: 0.75,
  controlHitRate: 0.75,
  fullChainHitRate: 0.625,
  abstainRate: 0.125,
  fallbackTriggerRate: 0.125,
  highRiskFalseNegativeRate: 0.25,
} as const

export const TAXONOMY_BENCHMARK_ATDD_EXPECTED_CONFUSION_MATRIX = {
  'IT04-04': {
    'IT04-04': 3,
    'IT04-05': 1,
  },
  'IT07-06': {
    'IT07-06': 2,
    UNCLASSIFIED: 1,
  },
} as const

export const TAXONOMY_BENCHMARK_ATDD_COMPARE_DISAGREEMENT = {
  caseId: 'IT07-CUTOVER-003',
  l1Code: 'IT07',
  tier: 'tier-1-cutover',
  riskTags: ['HIGH_RISK', 'HISTORICAL_FALLBACK'],
  newPath: {
    l2Code: 'IT07-06',
    pathDecision: 'UNCLASSIFIED',
    failureSemantic: 'LOW_CONFIDENCE',
  },
  legacyPath: {
    l2Code: 'IT07-05',
    pathDecision: 'LEGACY_FALLBACK',
    failureSemantic: 'LEGACY_FALLBACK_TRIGGERED',
  },
  missCategory: 'taxonomy',
  reason: 'new path abstained on a high-risk fallback slice while legacy still produced a control chain',
} as const

export const TAXONOMY_BENCHMARK_ATDD_EXPECTED_MISSING_SLICES = [
  'tier-1-cutover/high-risk',
  'tier-2-holdout/historical-fallback',
] as const

