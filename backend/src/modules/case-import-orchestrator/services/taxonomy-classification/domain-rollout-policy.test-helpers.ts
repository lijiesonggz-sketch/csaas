import { Repository } from 'typeorm'
import { KgTaxonomyDomainRolloutPolicy } from '../../../../database/entities/kg-taxonomy-domain-rollout-policy.entity'

export type RolloutPolicyRepositoryMock = jest.Mocked<
  Pick<Repository<KgTaxonomyDomainRolloutPolicy>, 'find' | 'findOne'>
>

export function createMockRolloutPolicyRepository(): RolloutPolicyRepositoryMock {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
  }
}

export function createRepositoryPolicy(
  overrides: Partial<KgTaxonomyDomainRolloutPolicy> & { l1Code: string },
): Partial<KgTaxonomyDomainRolloutPolicy> {
  return {
    id: `uuid-${overrides.l1Code.toLowerCase()}`,
    l1Code: overrides.l1Code,
    rolloutState: 'legacy-primary',
    allowLegacyFallback: true,
    primaryThreshold: '0.72',
    shadowWindowDays: 14,
    killSwitchEnabled: false,
    activeClassifierVersion: 'v2.0',
    stateChangedAt: new Date('2026-01-15T00:00:00.000Z'),
    mappingOwner: 'unassigned',
    rulebookOwner: 'unassigned',
    benchmarkOwner: 'unassigned',
    gateApprover: 'unassigned',
    rollbackApprover: 'unassigned',
    cutoverThresholdsJson: null,
    retirementThresholdsJson: null,
    retirementEvidenceJson: null,
    updatedAt: new Date('2026-01-16T00:00:00.000Z'),
    updatedBy: null,
    ...overrides,
  }
}
