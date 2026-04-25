import { DomainRolloutPolicyService } from './domain-rollout-policy.service'
import { TAXONOMY_ROLLOUT_POLICY_AUTOMATE_PERSISTED_POLICY } from '../../testing/taxonomy-rollout-policy-automate.fixtures'

describe('DomainRolloutPolicyService automation regression', () => {
  it('[P0][6.5-AUTO-001] should treat the repository row as the source of truth instead of synthesizing fallback defaults', async () => {
    const rolloutPolicyRepository = {
      find: jest.fn().mockResolvedValue([
        TAXONOMY_ROLLOUT_POLICY_AUTOMATE_PERSISTED_POLICY,
      ]),
    }

    const service = new DomainRolloutPolicyService(
      rolloutPolicyRepository as never,
    )

    const policies = await service.listPolicies()

    expect(policies).toEqual([
      expect.objectContaining({
        l1Code: 'IT07',
        rolloutState: 'domain-primary',
        allowLegacyFallback: false,
        primaryThreshold: 0.78,
        activeClassifierVersion: 'taxonomy-classifier-6.4',
      }),
    ])
  })

  it('[P1][6.5-AUTO-002] should fail closed when control-plane repository is absent or the requested domain row is missing', async () => {
    const noRepoService = new DomainRolloutPolicyService(undefined as never)
    const emptyRepoService = new DomainRolloutPolicyService({
      findOne: jest.fn().mockResolvedValue(null),
    } as never)

    await expect(noRepoService.listPolicies()).rejects.toThrow(
      'Domain rollout policy repository is required',
    )
    await expect(emptyRepoService.getPolicyForDomain('IT07')).rejects.toThrow(
      'No rollout policy configured for domain IT07.',
    )
  })
})
