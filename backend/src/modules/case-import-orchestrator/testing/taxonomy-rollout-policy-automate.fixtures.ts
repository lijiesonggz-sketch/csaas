export const TAXONOMY_ROLLOUT_POLICY_AUTOMATE_PERSISTED_POLICY = {
  id: 'policy-it07',
  l1Code: 'IT07',
  rolloutState: 'domain-primary',
  allowLegacyFallback: false,
  primaryThreshold: '0.7800',
  shadowWindowDays: 14,
  cutoverThresholdsJson: {
    canaryPercentage: 15,
    errorBudget: 0.015,
    rollbackPath: 'Enable kill switch and revert rollout state to domain-shadow',
  },
  retirementThresholdsJson: {
    fallbackRateMax: 0.03,
    unknownRateMax: 0.02,
    manualCorrectionRateMax: 0.08,
  },
  killSwitchEnabled: false,
  activeClassifierVersion: 'taxonomy-classifier-6.4',
  mappingOwner: 'owner-a',
  rulebookOwner: 'owner-b',
  benchmarkOwner: 'owner-c',
  gateApprover: 'owner-d',
  rollbackApprover: 'owner-e',
  updatedAt: new Date('2026-04-25T15:00:00+08:00'),
  updatedBy: 'user-1',
} as const

export const TAXONOMY_ROLLOUT_POLICY_AUTOMATE_INVALID_REPORT_SUMMARY = {
  generatedAt: '2026-04-25T15:30:00+08:00',
  reportId: 'other-report',
  mode: 'dual-path-compare',
  classifierVersion: 'taxonomy-classifier-6.4',
  domains: ['IT07'],
  metrics: {},
  groups: {
    IT07: {
      'tier-1-cutover': {
        'dual-path-compare': {
          gateStatus: 'PASS',
          metrics: {},
        },
      },
    },
  },
} as const

export const TAXONOMY_ROLLOUT_POLICY_AUTOMATE_INVALID_MODE_SUMMARY = {
  generatedAt: '2026-04-25T15:20:00+08:00',
  reportId: 'taxonomy-benchmark',
  mode: 'new-path',
  classifierVersion: 'taxonomy-classifier-6.4',
  domains: ['IT07'],
  metrics: {},
  groups: {
    IT07: {
      'tier-1-cutover': {
        'new-path': {
          gateStatus: 'PASS',
          metrics: {},
        },
      },
    },
  },
} as const

export const TAXONOMY_ROLLOUT_POLICY_AUTOMATE_VALID_SUMMARY = {
  generatedAt: '2026-04-25T15:10:00+08:00',
  reportId: 'taxonomy-benchmark',
  mode: 'dual-path-compare',
  classifierVersion: 'taxonomy-classifier-6.4',
  domains: ['IT07'],
  metrics: {
    fullChainHitRate: 0.8,
    fallbackTriggerRate: 0.01,
    highRiskFalseNegativeRate: 0,
    taxonomyPrecision: 0.9,
    taxonomyRecall: 0.9,
  },
  groups: {
    IT07: {
      'tier-1-cutover': {
        'dual-path-compare': {
          gateStatus: 'PASS',
          metrics: {
            fullChainHitRate: 0.8,
            fallbackTriggerRate: 0.01,
            highRiskFalseNegativeRate: 0,
            taxonomyPrecision: 0.9,
            taxonomyRecall: 0.9,
          },
        },
      },
    },
  },
} as const
