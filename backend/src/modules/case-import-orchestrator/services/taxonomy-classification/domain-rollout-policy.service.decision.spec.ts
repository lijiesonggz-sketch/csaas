import {
  DomainRolloutPolicyService,
  normalizePolicyOwnership,
  normalizeRetirementEvidence,
  type DomainRolloutPolicySnapshot,
} from './domain-rollout-policy.service'
import {
  TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION,
  TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION,
  TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION,
  TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION,
} from '../../testing/taxonomy-rollout-policy.atdd.fixtures'

const CLASSIFIED_AT = '2026-05-01T00:00:00.000Z'

function createPolicySnapshot(
  overrides: Partial<DomainRolloutPolicySnapshot> & {
    l1Code: string
    rolloutState: DomainRolloutPolicySnapshot['rolloutState']
  },
): DomainRolloutPolicySnapshot {
  return {
    id: null,
    l1Code: overrides.l1Code,
    rolloutState: overrides.rolloutState,
    allowLegacyFallback: overrides.allowLegacyFallback ?? true,
    primaryThreshold: overrides.primaryThreshold ?? 0.7,
    shadowWindowDays: overrides.shadowWindowDays ?? 14,
    cutoverThresholdsJson: overrides.cutoverThresholdsJson ?? {},
    retirementThresholdsJson: overrides.retirementThresholdsJson ?? {},
    killSwitchEnabled: overrides.killSwitchEnabled ?? false,
    activeClassifierVersion: overrides.activeClassifierVersion ?? 'taxonomy-classifier-6.4',
    stateChangedAt: overrides.stateChangedAt ?? null,
    retirementEvidenceJson: normalizeRetirementEvidence(overrides.retirementEvidenceJson),
    updatedAt: overrides.updatedAt ?? null,
    updatedBy: overrides.updatedBy ?? null,
    ...normalizePolicyOwnership(overrides),
  }
}

describe('DomainRolloutPolicyService rollout decision logic', () => {
  test('[8.1-SVC-008][P0] should resolve primary chain when policy authorizes primary and the chain is executable', async () => {
    const service = new DomainRolloutPolicyService(undefined as never)

    const decision = await service.resolvePolicyDecision({
      l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.l1Code,
      policy: createPolicySnapshot({
        l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.l1Code,
        rolloutState: TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.rolloutState,
        allowLegacyFallback: TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.allowLegacyFallback,
        primaryThreshold: 0.78,
        killSwitchEnabled: TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.killSwitchEnabled,
      }),
      classifierResult: {
        ...TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.classifierResult,
        l2Name: '核心业务系统数据被后台修改/篡改',
        score: 0.91,
        decisionSource: 'rule',
        matchedSignals: ['后台直接修改'],
        matchedPhrases: ['后台直接修改'],
        matchedTokens: ['后台'],
        classifierVersion: 'taxonomy-classifier-6.4',
        mappingVersion: '2026-04-07',
        rulebookVersion: 'it07-rulebook-v1',
        classifiedAt: CLASSIFIED_AT,
      },
      primaryExecutability: {
        ...TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.primaryExecutability,
        isExecutable: true,
        reason: 'READY',
      },
    })

    expect(decision).toEqual(
      expect.objectContaining({
        pathDecision: 'PRIMARY_CHAIN',
        failureSemantic: null,
        reason: 'primary-path-authorized',
      }),
    )
  })

  test('[8.1-SVC-009][P0] should force legacy fallback when kill switch is enabled', async () => {
    const service = new DomainRolloutPolicyService(undefined as never)

    const decision = await service.resolvePolicyDecision({
      l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.l1Code,
      policy: createPolicySnapshot({
        l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.l1Code,
        rolloutState: TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.rolloutState,
        allowLegacyFallback: TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.allowLegacyFallback,
        killSwitchEnabled: TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.killSwitchEnabled,
      }),
      classifierResult: {
        ...TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.classifierResult,
        l2Name: '核心业务系统数据被后台修改/篡改',
        score: 0.95,
        decisionSource: 'rule',
        matchedSignals: ['核心系统'],
        matchedPhrases: ['核心系统'],
        matchedTokens: ['核心'],
        classifierVersion: 'taxonomy-classifier-6.4',
        mappingVersion: '2026-04-07',
        rulebookVersion: 'it07-rulebook-v1',
        classifiedAt: CLASSIFIED_AT,
      },
      primaryExecutability: {
        ...TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.primaryExecutability,
        isExecutable: true,
        reason: 'READY',
      },
    })

    expect(decision).toEqual(
      expect.objectContaining({
        pathDecision: 'LEGACY_FALLBACK',
        failureSemantic: 'LEGACY_FALLBACK_TRIGGERED',
        reason: 'kill-switch-enabled',
      }),
    )
  })

  test('[8.1-SVC-010][P0] should fall back or abstain according to policy when primary conditions are not executable', async () => {
    const service = new DomainRolloutPolicyService(undefined as never)

    const fallbackDecision = await service.resolvePolicyDecision({
      l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION.l1Code,
      policy: createPolicySnapshot({
        l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION.l1Code,
        rolloutState: TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION.rolloutState,
        allowLegacyFallback: TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION.allowLegacyFallback,
        killSwitchEnabled: TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION.killSwitchEnabled,
      }),
      classifierResult: {
        ...TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION.classifierResult,
        l2Name: null,
        score: 0.44,
        decisionSource: 'none',
        matchedSignals: [],
        matchedPhrases: [],
        matchedTokens: [],
        classifierVersion: 'taxonomy-classifier-6.4',
        mappingVersion: '2026-04-07',
        rulebookVersion: 'it04-rulebook-v1',
        classifiedAt: CLASSIFIED_AT,
      },
      primaryExecutability: {
        ...TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION.primaryExecutability,
        isExecutable: false,
        reason: 'NO_PRIMARY_CLASSIFICATION',
      },
    })

    const abstainDecision = await service.resolvePolicyDecision({
      l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.l1Code,
      policy: createPolicySnapshot({
        l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.l1Code,
        rolloutState: TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.rolloutState,
        allowLegacyFallback: TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.allowLegacyFallback,
        killSwitchEnabled: TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.killSwitchEnabled,
      }),
      classifierResult: {
        ...TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.classifierResult,
        l2Name: '恢复演练与韧性验证不足',
        score: 0.82,
        decisionSource: 'semantic',
        matchedSignals: [],
        matchedPhrases: ['恢复演练'],
        matchedTokens: ['恢复'],
        classifierVersion: 'taxonomy-classifier-6.4',
        mappingVersion: '2026-04-07',
        rulebookVersion: 'it08-rulebook-v1',
        classifiedAt: CLASSIFIED_AT,
      },
      primaryExecutability: {
        ...TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.primaryExecutability,
        isExecutable: false,
        reason: 'NO_CONTROL_CANDIDATE',
      },
    })

    expect(fallbackDecision.pathDecision).toBe('LEGACY_FALLBACK')
    expect(abstainDecision.pathDecision).toBe('ABSTAIN')
  })

  test('[8.1-SVC-011][P0] should disable legacy fallback when rollout state is legacy-off and preserve engine failures from chain-query outages', async () => {
    const service = new DomainRolloutPolicyService(undefined as never)

    const legacyOffDecision = await service.resolvePolicyDecision({
      l1Code: 'IT07',
      policy: createPolicySnapshot({
        l1Code: 'IT07',
        rolloutState: 'legacy-off',
        allowLegacyFallback: true,
        primaryThreshold: 0.78,
      }),
      classifierResult: {
        l1Code: 'IT07',
        l2Code: null,
        l2Name: null,
        score: 0,
        confidenceScore: 0,
        scoreGap: 0,
        decisionSource: 'none',
        matchedSignals: [],
        matchedPhrases: [],
        matchedTokens: [],
        classifierVersion: 'taxonomy-classifier-6.4',
        mappingVersion: '2026-04-07',
        rulebookVersion: 'it07-rulebook-v1',
        classifiedAt: CLASSIFIED_AT,
        pathDecision: 'UNCLASSIFIED',
        failureSemantics: 'NO_MATCH',
      },
      primaryExecutability: {
        failureModeCount: 0,
        controlCandidateCount: 0,
        isExecutable: false,
        reason: 'NO_PRIMARY_CLASSIFICATION',
      },
    })

    const chainQueryFailureDecision = await service.resolvePolicyDecision({
      l1Code: 'IT07',
      policy: createPolicySnapshot({
        l1Code: 'IT07',
        rolloutState: 'domain-primary',
        allowLegacyFallback: true,
        primaryThreshold: 0.78,
      }),
      classifierResult: {
        l1Code: 'IT07',
        l2Code: 'IT07-06',
        l2Name: '核心业务系统数据被后台修改/篡改',
        score: 0.9,
        confidenceScore: 0.9,
        scoreGap: 0.2,
        decisionSource: 'rule',
        matchedSignals: ['后台'],
        matchedPhrases: ['后台'],
        matchedTokens: ['后台'],
        classifierVersion: 'taxonomy-classifier-6.4',
        mappingVersion: '2026-04-07',
        rulebookVersion: 'it07-rulebook-v1',
        classifiedAt: CLASSIFIED_AT,
        pathDecision: 'PRIMARY_CHAIN',
        failureSemantics: null,
      },
      primaryExecutability: {
        failureModeCount: 0,
        controlCandidateCount: 0,
        isExecutable: false,
        reason: 'CHAIN_QUERY_FAILED',
      },
    })

    expect(legacyOffDecision.pathDecision).toBe('UNCLASSIFIED')
    expect(chainQueryFailureDecision.failureSemantic).toBe('ENGINE_ERROR')
  })
})
