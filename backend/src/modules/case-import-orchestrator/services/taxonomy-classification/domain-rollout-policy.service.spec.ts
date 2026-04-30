import {
  createBootstrapDomainRolloutPolicies,
  DomainRolloutPolicyService,
  normalizePolicyOwnership,
  normalizeRetirementEvidence,
  stateAllowsPrimaryPath,
  validateRolloutTransition,
} from './domain-rollout-policy.service'
import { TAXONOMY_ROLLOUT_POLICY_ATDD_OWNER_ASSIGNMENTS } from '../../testing/taxonomy-rollout-policy.atdd.fixtures'

describe('DomainRolloutPolicyService core policy semantics', () => {
  test('[8.1-SVC-001][P0] should bootstrap stable per-domain defaults for runtime-ready domains', () => {
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

  test('[8.1-SVC-002][P1] should normalize owner assignments with safe defaults', () => {
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

  test('[8.1-SVC-003][P0] should enforce forward-only adjacent state promotions while allowing rollback', () => {
    expect(() => validateRolloutTransition('legacy-primary', 'it04-on-new-interface')).not.toThrow()
    expect(() => validateRolloutTransition('domain-primary', 'domain-compare')).not.toThrow()
    expect(() => validateRolloutTransition('legacy-primary', 'legacy-off')).toThrow(/skip/i)
  })

  test('[8.1-SVC-004][P0] should expose primary path only for states that authorize it', () => {
    expect(stateAllowsPrimaryPath('legacy-primary')).toBe(false)
    expect(stateAllowsPrimaryPath('domain-shadow')).toBe(false)
    expect(stateAllowsPrimaryPath('it04-on-new-interface')).toBe(true)
    expect(stateAllowsPrimaryPath('domain-primary')).toBe(true)
    expect(stateAllowsPrimaryPath('legacy-off')).toBe(true)
  })

  test.each([
    [
      '8.1-SVC-005',
      'legacy-primary with fallback enabled and no evidence',
      {
        rolloutState: 'legacy-primary',
        allowLegacyFallback: true,
        retirementEvidenceJson: normalizeRetirementEvidence(),
      },
      {
        stateAllowsPrimary: false,
        stateAllowsLegacyFallback: true,
        hasRetirementEvidence: false,
      },
    ],
    [
      '8.1-SVC-006',
      'domain-primary with fallback disabled and cutover evidence',
      {
        rolloutState: 'domain-primary',
        allowLegacyFallback: false,
        retirementEvidenceJson: normalizeRetirementEvidence({
          lastCutoverAt: '2026-01-10T00:00:00.000Z',
        }),
      },
      {
        stateAllowsPrimary: true,
        stateAllowsLegacyFallback: false,
        hasRetirementEvidence: true,
      },
    ],
    [
      '8.1-SVC-007',
      'legacy-off with allowLegacyFallback=true and report evidence',
      {
        rolloutState: 'legacy-off',
        allowLegacyFallback: true,
        retirementEvidenceJson: normalizeRetirementEvidence({
          lastRetirementReportPath: '/reports/it07-retirement.json',
        }),
      },
      {
        stateAllowsPrimary: true,
        stateAllowsLegacyFallback: false,
        hasRetirementEvidence: true,
      },
    ],
  ])('[%s][P0] should derive readiness summary for %s', (_testId, _label, policy, expected) => {
    const service = new DomainRolloutPolicyService(undefined as never)

    expect(service.getReadinessSummary(policy as never)).toEqual(expected)
  })
})
