import {
  createBootstrapDomainRolloutPolicies,
  DomainRolloutPolicyService,
  normalizePolicyOwnership,
  stateAllowsPrimaryPath,
  validateRolloutTransition,
} from './domain-rollout-policy.service'
import {
  TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION,
  TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION,
  TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION,
  TAXONOMY_ROLLOUT_POLICY_ATDD_OWNER_ASSIGNMENTS,
  TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION,
} from '../../testing/taxonomy-rollout-policy.atdd.fixtures'

describe('DomainRolloutPolicyService', () => {
  it('should bootstrap stable per-domain defaults for runtime-ready domains', () => {
    const policies = createBootstrapDomainRolloutPolicies({
      domainCodes: ['IT01', 'IT04', 'IT07'],
      activeClassifierVersion: 'taxonomy-classifier-6.4',
    })

    expect(policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          l1Code: 'IT01',
          rolloutState: 'legacy-primary',
          activeClassifierVersion: 'taxonomy-classifier-6.4',
        }),
        expect.objectContaining({
          l1Code: 'IT04',
          rolloutState: 'it04-on-new-interface',
        }),
        expect.objectContaining({
          l1Code: 'IT07',
          rolloutState: 'domain-compare',
        }),
      ]),
    )
  })

  it('should normalize owner assignments with safe defaults', () => {
    expect(normalizePolicyOwnership({})).toEqual({
      mappingOwner: 'unassigned',
      rulebookOwner: 'unassigned',
      benchmarkOwner: 'unassigned',
      gateApprover: 'unassigned',
      rollbackApprover: 'unassigned',
    })
    expect(normalizePolicyOwnership(TAXONOMY_ROLLOUT_POLICY_ATDD_OWNER_ASSIGNMENTS)).toEqual(
      TAXONOMY_ROLLOUT_POLICY_ATDD_OWNER_ASSIGNMENTS,
    )
  })

  it('should enforce forward-only adjacent state promotions while allowing rollback', () => {
    expect(() =>
      validateRolloutTransition('legacy-primary', 'it04-on-new-interface'),
    ).not.toThrow()
    expect(() =>
      validateRolloutTransition('domain-primary', 'domain-compare'),
    ).not.toThrow()
    expect(() =>
      validateRolloutTransition('legacy-primary', 'legacy-off'),
    ).toThrow(/skip/i)
  })

  it('should expose primary path only for states that authorize it', () => {
    expect(stateAllowsPrimaryPath('legacy-primary')).toBe(false)
    expect(stateAllowsPrimaryPath('domain-shadow')).toBe(false)
    expect(stateAllowsPrimaryPath('it04-on-new-interface')).toBe(true)
    expect(stateAllowsPrimaryPath('domain-primary')).toBe(true)
    expect(stateAllowsPrimaryPath('legacy-off')).toBe(true)
  })

  it('should resolve primary chain when policy authorizes primary and the chain is executable', async () => {
    const service = new DomainRolloutPolicyService(undefined as never)

    const decision = await service.resolvePolicyDecision({
      l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.l1Code,
      policy: {
        id: null,
        l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.l1Code,
        rolloutState: TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.rolloutState,
        allowLegacyFallback:
          TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.allowLegacyFallback,
        primaryThreshold: 0.78,
        shadowWindowDays: 14,
        cutoverThresholdsJson: {},
        retirementThresholdsJson: {},
        killSwitchEnabled:
          TAXONOMY_ROLLOUT_POLICY_ATDD_PRIMARY_DECISION.killSwitchEnabled,
        activeClassifierVersion: 'taxonomy-classifier-6.4',
        updatedAt: null,
        updatedBy: null,
        ...normalizePolicyOwnership({}),
      },
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
        classifiedAt: new Date().toISOString(),
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

  it('should force legacy fallback when kill switch is enabled', async () => {
    const service = new DomainRolloutPolicyService(undefined as never)

    const decision = await service.resolvePolicyDecision({
      l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.l1Code,
      policy: {
        id: null,
        l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.l1Code,
        rolloutState:
          TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.rolloutState,
        allowLegacyFallback:
          TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.allowLegacyFallback,
        primaryThreshold: 0.7,
        shadowWindowDays: 14,
        cutoverThresholdsJson: {},
        retirementThresholdsJson: {},
        killSwitchEnabled:
          TAXONOMY_ROLLOUT_POLICY_ATDD_KILL_SWITCH_DECISION.killSwitchEnabled,
        activeClassifierVersion: 'taxonomy-classifier-6.4',
        updatedAt: null,
        updatedBy: null,
        ...normalizePolicyOwnership({}),
      },
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
        classifiedAt: new Date().toISOString(),
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

  it('should fall back or abstain according to policy when primary conditions are not executable', async () => {
    const service = new DomainRolloutPolicyService(undefined as never)

    const fallbackDecision = await service.resolvePolicyDecision({
      l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION.l1Code,
      policy: {
        id: null,
        l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION.l1Code,
        rolloutState:
          TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION.rolloutState,
        allowLegacyFallback:
          TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION.allowLegacyFallback,
        primaryThreshold: 0.7,
        shadowWindowDays: 14,
        cutoverThresholdsJson: {},
        retirementThresholdsJson: {},
        killSwitchEnabled:
          TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION.killSwitchEnabled,
        activeClassifierVersion: 'taxonomy-classifier-6.4',
        updatedAt: null,
        updatedBy: null,
        ...normalizePolicyOwnership({}),
      },
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
        classifiedAt: new Date().toISOString(),
      },
      primaryExecutability: {
        ...TAXONOMY_ROLLOUT_POLICY_ATDD_FALLBACK_DECISION.primaryExecutability,
        isExecutable: false,
        reason: 'NO_PRIMARY_CLASSIFICATION',
      },
    })

    const abstainDecision = await service.resolvePolicyDecision({
      l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.l1Code,
      policy: {
        id: null,
        l1Code: TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.l1Code,
        rolloutState:
          TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.rolloutState,
        allowLegacyFallback:
          TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.allowLegacyFallback,
        primaryThreshold: 0.7,
        shadowWindowDays: 14,
        cutoverThresholdsJson: {},
        retirementThresholdsJson: {},
        killSwitchEnabled:
          TAXONOMY_ROLLOUT_POLICY_ATDD_ABSTAIN_DECISION.killSwitchEnabled,
        activeClassifierVersion: 'taxonomy-classifier-6.4',
        updatedAt: null,
        updatedBy: null,
        ...normalizePolicyOwnership({}),
      },
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
        classifiedAt: new Date().toISOString(),
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

  it('should disable legacy fallback when rollout state is legacy-off and preserve engine failures from chain-query outages', async () => {
    const service = new DomainRolloutPolicyService(undefined as never)

    const legacyOffDecision = await service.resolvePolicyDecision({
      l1Code: 'IT07',
      policy: {
        id: null,
        l1Code: 'IT07',
        rolloutState: 'legacy-off',
        allowLegacyFallback: true,
        primaryThreshold: 0.78,
        shadowWindowDays: 14,
        cutoverThresholdsJson: {},
        retirementThresholdsJson: {},
        killSwitchEnabled: false,
        activeClassifierVersion: 'taxonomy-classifier-6.4',
        updatedAt: null,
        updatedBy: null,
        ...normalizePolicyOwnership({}),
      },
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
        classifiedAt: new Date().toISOString(),
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
      policy: {
        id: null,
        l1Code: 'IT07',
        rolloutState: 'domain-primary',
        allowLegacyFallback: true,
        primaryThreshold: 0.78,
        shadowWindowDays: 14,
        cutoverThresholdsJson: {},
        retirementThresholdsJson: {},
        killSwitchEnabled: false,
        activeClassifierVersion: 'taxonomy-classifier-6.4',
        updatedAt: null,
        updatedBy: null,
        ...normalizePolicyOwnership({}),
      },
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
        classifiedAt: new Date().toISOString(),
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
