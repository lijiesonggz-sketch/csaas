import {
  TAXONOMY_ROLLOUT_POLICY_ATDD_BOOTSTRAP_POLICIES,
  TAXONOMY_ROLLOUT_POLICY_ATDD_EXPECTED_STATES,
  TAXONOMY_ROLLOUT_POLICY_ATDD_OWNER_ASSIGNMENTS,
  TAXONOMY_ROLLOUT_POLICY_ATDD_OWNER_FIELDS,
  TAXONOMY_ROLLOUT_POLICY_ATDD_REQUIRED_POLICY_FIELDS,
} from '../../testing/taxonomy-rollout-policy.atdd.fixtures'

describe('Story 6.5 - Domain Rollout Policy (ATDD)', () => {
  it.skip(
    '[P0][6.5-UNIT-001] should persist per-domain rollout policies with the required control-plane fields and bootstrap IT01-IT08 defaults instead of hiding rollout flags in env vars',
    () => {
      const {
        KG_TAXONOMY_DOMAIN_ROLLOUT_STATES,
        createBootstrapDomainRolloutPolicies,
      } = require('./domain-rollout-policy.service')

      const policies = createBootstrapDomainRolloutPolicies({
        domainCodes: ['IT01', 'IT02', 'IT03', 'IT04', 'IT05', 'IT06', 'IT07', 'IT08'],
        activeClassifierVersion: 'taxonomy-classifier-6.4',
      })

      expect(KG_TAXONOMY_DOMAIN_ROLLOUT_STATES).toEqual(
        TAXONOMY_ROLLOUT_POLICY_ATDD_EXPECTED_STATES,
      )
      expect(policies).toEqual(
        expect.arrayContaining(
          TAXONOMY_ROLLOUT_POLICY_ATDD_BOOTSTRAP_POLICIES.map((policy) =>
            expect.objectContaining(policy),
          ),
        ),
      )

      for (const field of TAXONOMY_ROLLOUT_POLICY_ATDD_REQUIRED_POLICY_FIELDS) {
        expect(policies[0]).toHaveProperty(field)
      }
    },
  )

  it.skip(
    '[P0][6.5-UNIT-002] should enforce the rollout state machine order and reject direct legacy-off promotion that skips shadow or compare evidence',
    () => {
      const { validateRolloutTransition } = require('./domain-rollout-policy.service')

      expect(() =>
        validateRolloutTransition('legacy-primary', 'it04-on-new-interface'),
      ).not.toThrow()
      expect(() =>
        validateRolloutTransition('it04-on-new-interface', 'domain-shadow'),
      ).not.toThrow()
      expect(() =>
        validateRolloutTransition('domain-shadow', 'domain-compare'),
      ).not.toThrow()
      expect(() =>
        validateRolloutTransition('domain-compare', 'domain-primary'),
      ).not.toThrow()
      expect(() =>
        validateRolloutTransition('domain-primary', 'legacy-off'),
      ).not.toThrow()

      expect(() =>
        validateRolloutTransition('legacy-primary', 'legacy-off'),
      ).toThrow(/skip/i)
      expect(() =>
        validateRolloutTransition('domain-shadow', 'legacy-off'),
      ).toThrow(/shadow|compare/i)
    },
  )

  it.skip(
    '[P1][6.5-UNIT-003] should persist owner and approver assignments together with kill-switch and threshold metadata as auditable policy state',
    () => {
      const { normalizePolicyOwnership } = require('./domain-rollout-policy.service')

      const ownership = normalizePolicyOwnership({
        ...TAXONOMY_ROLLOUT_POLICY_ATDD_BOOTSTRAP_POLICIES[2],
        ...TAXONOMY_ROLLOUT_POLICY_ATDD_OWNER_ASSIGNMENTS,
      })

      for (const field of TAXONOMY_ROLLOUT_POLICY_ATDD_OWNER_FIELDS) {
        expect(ownership).toHaveProperty(field)
      }

      expect(ownership).toEqual(
        expect.objectContaining(TAXONOMY_ROLLOUT_POLICY_ATDD_OWNER_ASSIGNMENTS),
      )
      expect(ownership.rollbackApprover).not.toBe(ownership.mappingOwner)
    },
  )
})
