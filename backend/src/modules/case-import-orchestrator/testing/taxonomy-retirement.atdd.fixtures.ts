export const TAXONOMY_RETIREMENT_ATDD_REQUIRED_REPORT_FIELDS = [
  'affectedDomains',
  'gateResults',
  'finalFallbackRate',
  'rollbackReadiness',
  'smokeVerification',
] as const

export const TAXONOMY_RETIREMENT_ATDD_REQUIRED_PREREQUISITES = [
  'cutoverTierPassed',
  'observationWindowPassed',
  'killSwitchDrillPassed',
  'rollbackVerified',
  'reclassifyReady',
  'backfillReady',
] as const

export const TAXONOMY_RETIREMENT_ATDD_READY_RETIREMENT_GATE = {
  l1Code: 'IT07',
  currentState: 'domain-primary',
  targetState: 'legacy-off',
  allowed: true,
  gateStatus: 'PASS',
  blockingReasons: [],
  metrics: {
    totalRuns: 42,
    fallbackCount: 1,
    unknownCount: 0,
    manualCorrectionCount: 1,
    fallbackRate: 0.0238,
    unknownRate: 0,
    manualCorrectionRate: 0.0238,
    errorBudgetConsumed: 0.0238,
    observationWindowDays: 14,
  },
  rolloutGuidance: {
    canaryPercentage: 15,
    errorBudget: 0.05,
    rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
  },
} as const

export const TAXONOMY_RETIREMENT_ATDD_MISSING_PREREQUISITES = {
  cutoverTierPassed: true,
  observationWindowPassed: true,
  killSwitchDrillPassed: false,
  rollbackVerified: false,
  reclassifyReady: false,
  backfillReady: true,
} as const

export const TAXONOMY_RETIREMENT_ATDD_READY_PREREQUISITES = {
  cutoverTierPassed: true,
  observationWindowPassed: true,
  killSwitchDrillPassed: true,
  rollbackVerified: true,
  reclassifyReady: true,
  backfillReady: true,
} as const

export const TAXONOMY_RETIREMENT_ATDD_EXPECTED_REPORT = {
  affectedDomains: ['IT07'],
  gateResults: {
    legacyOff: 'PASS',
    cleanup: 'DEFERRED',
  },
  finalFallbackRate:
    TAXONOMY_RETIREMENT_ATDD_READY_RETIREMENT_GATE.metrics.fallbackRate,
  rollbackReadiness: {
    verified: true,
    path: 'Enable kill switch and revert rollout state to domain-primary',
  },
  smokeVerification: {
    passed: true,
    checkedAt: '2026-04-25T17:17:22+08:00',
  },
} as const

export const TAXONOMY_RETIREMENT_ATDD_RELEASE_GUARD = {
  l1Code: 'IT07',
  isFirstNonIt04PrimaryDomain: true,
  currentReleaseId: 'kg-v2-r1',
  retiredAt: '2026-04-25T17:17:22+08:00',
  stableWindowDays: 14,
} as const

export const TAXONOMY_RETIREMENT_ATDD_RECLASSIFY_SCOPE = {
  batchId: 'batch-7',
  caseIds: ['case-7', 'case-8'],
  l1Code: 'IT07',
  classifierVersion: 'taxonomy-classifier-6.6',
  shadowOnly: true,
  forceLatestPointer: false,
  dryRun: true,
} as const

export const TAXONOMY_RETIREMENT_ATDD_RECLASSIFY_REPORT = {
  dryRun: true,
  reranClustering: false,
  latestPointerUpdated: false,
  caseCount: 2,
  affectedDomains: ['IT07'],
} as const

export const TAXONOMY_RETIREMENT_ATDD_BACKFILL_REPORT = {
  requestedCount: 2,
  resetCount: 2,
  extractedCount: 0,
  clusteredCount: 0,
  affectedDomains: ['IT07'],
  rollbackCompatible: true,
  requiresLegacyCodeRestore: false,
} as const

export const TAXONOMY_RETIREMENT_ATDD_RETIRED_POLICY = {
  l1Code: 'IT07',
  rolloutState: 'legacy-off',
  allowLegacyFallback: false,
} as const

export const TAXONOMY_RETIREMENT_ATDD_ACTIVE_POLICY = {
  l1Code: 'IT02',
  rolloutState: 'domain-shadow',
  allowLegacyFallback: true,
} as const

export const TAXONOMY_RETIREMENT_ATDD_NORMALIZATION_SAMPLE = {
  rawText: 'EAST 报送字段映射错误，导致监管报送数据不准确',
  expectedTokens: ['EAST', '报送', '字段映射', '错误'],
} as const
