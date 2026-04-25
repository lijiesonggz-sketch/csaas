export const TAXONOMY_ROLLOUT_POLICY_ATDD_REQUIRED_POLICY_FIELDS = [
  'l1Code',
  'rolloutState',
  'allowLegacyFallback',
  'primaryThreshold',
  'shadowWindowDays',
  'cutoverThresholdsJson',
  'retirementThresholdsJson',
  'killSwitchEnabled',
  'activeClassifierVersion',
] as const

export const TAXONOMY_ROLLOUT_POLICY_ATDD_OWNER_FIELDS = [
  'mappingOwner',
  'rulebookOwner',
  'benchmarkOwner',
  'gateApprover',
  'rollbackApprover',
] as const

export const TAXONOMY_ROLLOUT_POLICY_ATDD_EXPECTED_STATES = [
  'legacy-primary',
  'it04-on-new-interface',
  'domain-shadow',
  'domain-compare',
  'domain-primary',
  'legacy-off',
] as const

export const TAXONOMY_ROLLOUT_POLICY_ATDD_BOOTSTRAP_POLICIES = [
  {
    l1Code: 'IT01',
    rolloutState: 'legacy-primary',
    allowLegacyFallback: true,
    primaryThreshold: 0.72,
    shadowWindowDays: 14,
    cutoverThresholdsJson: {
      canaryPercentage: 10,
      errorBudget: 0.02,
      benchmarkGate: 'cutover',
    },
    retirementThresholdsJson: {
      fallbackRateMax: 0.05,
      unknownRateMax: 0.03,
      manualCorrectionRateMax: 0.1,
    },
    killSwitchEnabled: false,
    activeClassifierVersion: 'taxonomy-classifier-6.4',
  },
  {
    l1Code: 'IT04',
    rolloutState: 'it04-on-new-interface',
    allowLegacyFallback: true,
    primaryThreshold: 0.7,
    shadowWindowDays: 14,
    cutoverThresholdsJson: {
      canaryPercentage: 10,
      errorBudget: 0.02,
      benchmarkGate: 'cutover',
    },
    retirementThresholdsJson: {
      fallbackRateMax: 0.05,
      unknownRateMax: 0.03,
      manualCorrectionRateMax: 0.1,
    },
    killSwitchEnabled: false,
    activeClassifierVersion: 'taxonomy-classifier-6.4',
  },
  {
    l1Code: 'IT07',
    rolloutState: 'domain-compare',
    allowLegacyFallback: true,
    primaryThreshold: 0.78,
    shadowWindowDays: 14,
    cutoverThresholdsJson: {
      canaryPercentage: 15,
      errorBudget: 0.015,
      benchmarkGate: 'cutover',
    },
    retirementThresholdsJson: {
      fallbackRateMax: 0.03,
      unknownRateMax: 0.02,
      manualCorrectionRateMax: 0.08,
    },
    killSwitchEnabled: false,
    activeClassifierVersion: 'taxonomy-classifier-6.4',
  },
] as const

export const TAXONOMY_ROLLOUT_POLICY_ATDD_OWNER_ASSIGNMENTS = {
  mappingOwner: 'kg-mapping-owner',
  rulebookOwner: 'kg-rulebook-owner',
  benchmarkOwner: 'kg-benchmark-owner',
  gateApprover: 'kg-gate-approver',
  rollbackApprover: 'kg-rollback-approver',
} as const

export const TAXONOMY_ROLLOUT_POLICY_ATDD_MACHINE_SUMMARY = {
  generatedAt: '2026-04-25T14:40:00+08:00',
  reportId: 'taxonomy-benchmark',
  mode: 'dual-path-compare',
  classifierVersion: 'taxonomy-classifier-6.4',
  domains: ['IT07'],
  tiers: ['tier-0-smoke', 'tier-1-cutover', 'tier-2-holdout'],
  gateStatus: 'PASS',
  metrics: {
    totalCases: 36,
    taxonomyHitCount: 32,
    failureModeHitCount: 31,
    controlHitCount: 29,
    evidenceHitCount: 28,
    fullChainHitCount: 28,
    taxonomyPrecision: 0.8889,
    taxonomyRecall: 0.8889,
    taxonomyF1: 0.8889,
    failureModeHitRate: 0.8611,
    controlHitRate: 0.8056,
    evidenceHitRate: 0.7778,
    fullChainHitRate: 0.7778,
    abstainCount: 2,
    abstainRate: 0.0556,
    fallbackTriggerCount: 1,
    fallbackTriggerRate: 0.0278,
    highRiskCaseCount: 8,
    highRiskFalseNegativeCount: 0,
    highRiskFalseNegativeRate: 0,
    missCategoryCounts: {
      taxonomy: 2,
      failure_mode: 1,
      control: 3,
      evidence: 2,
    },
    confusionMatrix: {
      'IT07-06': { 'IT07-06': 14, UNCLASSIFIED: 1 },
      'IT07-03': { 'IT07-03': 10 },
      'IT07-09': { 'IT07-09': 8, 'IT07-10': 1 },
    },
  },
  thresholds: {
    taxonomyPrecision: 0.85,
    taxonomyRecall: 0.85,
    fullChainHitRate: 0.75,
    highRiskFalseNegativeRate: 0.05,
    fallbackTriggerRate: 0.05,
  },
  missingSlices: [],
  groups: {
    IT07: {
      'tier-1-cutover': {
        'dual-path-compare': {
          sampleCount: 12,
          gateStatus: 'PASS',
          metrics: {
            fallbackTriggerRate: 0.0417,
            highRiskFalseNegativeRate: 0,
            fullChainHitRate: 0.75,
          },
        },
      },
      'tier-2-holdout': {
        'dual-path-compare': {
          sampleCount: 8,
          gateStatus: 'PASS',
          metrics: {
            fallbackTriggerRate: 0,
            highRiskFalseNegativeRate: 0,
            fullChainHitRate: 0.75,
          },
        },
      },
    },
  },
} as const

export const TAXONOMY_ROLLOUT_POLICY_ATDD_RUNTIME_WINDOW = {
  l1Code: 'IT07',
  rolloutState: 'domain-compare',
  observationWindowDays: 14,
  totalRuns: 42,
  fallbackCount: 1,
  unknownCount: 1,
  manualCorrectionCount: 2,
  fallbackRate: 0.0238,
  unknownRate: 0.0238,
  manualCorrectionRate: 0.0476,
  errorBudgetConsumed: 0.011,
} as const

export const TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION = {
  l1Code: 'IT07',
  rolloutState: 'domain-primary',
  allowLegacyFallback: false,
  killSwitchEnabled: false,
  classifierResult: {
    l1Code: 'IT07',
    l2Code: 'IT07-06',
    confidenceScore: 0.91,
    scoreGap: 0.18,
    pathDecision: 'PRIMARY_CHAIN',
    failureSemantics: null,
  },
  primaryExecutability: {
    failureModeCount: 2,
    controlCandidateCount: 3,
  },
  expectedPathDecision: 'PRIMARY_CHAIN',
} as const

export const TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION = {
  l1Code: 'IT04',
  rolloutState: 'domain-compare',
  allowLegacyFallback: true,
  killSwitchEnabled: false,
  classifierResult: {
    l1Code: 'IT04',
    l2Code: null,
    confidenceScore: 0.44,
    scoreGap: 0.01,
    pathDecision: 'UNCLASSIFIED',
    failureSemantics: 'LOW_CONFIDENCE',
  },
  primaryExecutability: {
    failureModeCount: 0,
    controlCandidateCount: 0,
  },
  expectedPathDecision: 'LEGACY_FALLBACK',
  expectedFallbackReason: 'LOW_CONFIDENCE',
} as const

export const TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION = {
  l1Code: 'IT07',
  rolloutState: 'domain-shadow',
  allowLegacyFallback: true,
  killSwitchEnabled: true,
  classifierResult: {
    l1Code: 'IT07',
    l2Code: 'IT07-06',
    confidenceScore: 0.95,
    scoreGap: 0.22,
    pathDecision: 'PRIMARY_CHAIN',
    failureSemantics: null,
  },
  primaryExecutability: {
    failureModeCount: 2,
    controlCandidateCount: 4,
  },
  expectedPathDecision: 'LEGACY_FALLBACK',
  expectedFallbackReason: 'LEGACY_FALLBACK_TRIGGERED',
} as const

export const TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION = {
  l1Code: 'IT08',
  rolloutState: 'domain-primary',
  allowLegacyFallback: false,
  killSwitchEnabled: false,
  classifierResult: {
    l1Code: 'IT08',
    l2Code: 'IT08-03',
    confidenceScore: 0.82,
    scoreGap: 0.16,
    pathDecision: 'PRIMARY_CHAIN',
    failureSemantics: null,
  },
  primaryExecutability: {
    failureModeCount: 0,
    controlCandidateCount: 0,
  },
  expectedPathDecision: 'ABSTAIN',
  expectedFallbackReason: 'MAPPING_MISSING',
} as const

export const TAXONOMY_ROLLOUT_POLICY_ATDD_EXPECTED_CONTROL_PLANE_FIELDS = [
  'currentState',
  'targetState',
  'allowed',
  'gateStatus',
  'blockingReasons',
  'metrics',
  'rolloutGuidance',
] as const
