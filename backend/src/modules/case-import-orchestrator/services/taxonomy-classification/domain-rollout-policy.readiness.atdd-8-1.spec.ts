import {
  createBootstrapDomainRolloutPolicies,
  DomainRolloutPolicyService,
} from './domain-rollout-policy.service'
import {
  createMockRolloutPolicyRepository,
  createRepositoryPolicy,
  type RolloutPolicyRepositoryMock,
} from './domain-rollout-policy.test-helpers'

describe('DomainRolloutPolicyService - Story 8.1 readiness ATDD', () => {
  let service: DomainRolloutPolicyService
  let mockRepository: RolloutPolicyRepositoryMock

  beforeEach(() => {
    mockRepository = createMockRolloutPolicyRepository()
    service = new DomainRolloutPolicyService(mockRepository as never)
  })

  describe('Readiness summary aggregation (AC#3)', () => {
    test('[8.1-SVCATDD-009][P0] should compute readiness summary from findAll() result with DB policies and bootstrap supplementation', async () => {
      mockRepository.find.mockResolvedValue([
        createRepositoryPolicy({ l1Code: 'IT01' }),
        createRepositoryPolicy({
          l1Code: 'IT04',
          rolloutState: 'it04-on-new-interface',
          primaryThreshold: '0.7',
        }),
        createRepositoryPolicy({
          l1Code: 'IT07',
          rolloutState: 'domain-primary',
          allowLegacyFallback: false,
          primaryThreshold: '0.78',
          mappingOwner: 'team-a',
          rulebookOwner: 'team-b',
          benchmarkOwner: 'team-c',
          gateApprover: 'lead-1',
          rollbackApprover: 'lead-2',
        }),
      ] as any)

      const result = await service.findAll()
      const ready = result.filter(
        (policy) => service.getReadinessSummary(policy).stateAllowsPrimary,
      )
      const notReady = result.filter(
        (policy) => !service.getReadinessSummary(policy).stateAllowsPrimary,
      )

      expect(result).toHaveLength(8)
      expect(ready).toHaveLength(2)
      expect(notReady).toHaveLength(6)
      expect(ready.map((policy) => policy.l1Code).sort()).toEqual(['IT04', 'IT07'])
      expect(notReady.map((policy) => policy.l1Code)).toEqual([
        'IT01',
        'IT02',
        'IT03',
        'IT05',
        'IT06',
        'IT08',
      ])
    })

    test('[8.1-SVCATDD-010][P0] should compute readiness summary from bootstrap fallback when DB is empty', async () => {
      mockRepository.find.mockResolvedValue([])

      const result = await service.findAll()
      const ready = result.filter(
        (policy) => service.getReadinessSummary(policy).stateAllowsPrimary,
      )
      const notReady = result.filter(
        (policy) => !service.getReadinessSummary(policy).stateAllowsPrimary,
      )

      expect(result).toHaveLength(8)
      expect(ready).toHaveLength(1)
      expect(ready[0].l1Code).toBe('IT04')
      expect(notReady).toHaveLength(7)
    })

    test('[8.1-SVCATDD-011][P0] should compute readiness summary from bootstrap fallback when repository is not available', async () => {
      const serviceWithoutRepo = new DomainRolloutPolicyService(undefined as any)

      const result = await serviceWithoutRepo.findAll()
      const ready = result.filter(
        (policy) => serviceWithoutRepo.getReadinessSummary(policy).stateAllowsPrimary,
      )
      const notReady = result.filter(
        (policy) => !serviceWithoutRepo.getReadinessSummary(policy).stateAllowsPrimary,
      )

      expect(result).toHaveLength(8)
      expect(ready).toHaveLength(1)
      expect(ready[0].l1Code).toBe('IT04')
      expect(notReady).toHaveLength(7)
    })
  })

  describe('Bootstrap defaults (AC#4)', () => {
    test('[8.1-SVCATDD-012][P0] should generate correct bootstrap policies for all 8 domains', () => {
      const bootstrapPolicies = createBootstrapDomainRolloutPolicies()

      expect(bootstrapPolicies).toHaveLength(8)
      expect(bootstrapPolicies.map((p) => p.l1Code)).toEqual([
        'IT01',
        'IT02',
        'IT03',
        'IT04',
        'IT05',
        'IT06',
        'IT07',
        'IT08',
      ])

      const it04 = bootstrapPolicies.find((p) => p.l1Code === 'IT04')
      expect(it04?.rolloutState).toBe('it04-on-new-interface')
      expect(it04?.primaryThreshold).toBe(0.7)

      const it07 = bootstrapPolicies.find((p) => p.l1Code === 'IT07')
      expect(it07?.rolloutState).toBe('domain-compare')
      expect(it07?.primaryThreshold).toBe(0.78)

      const it01 = bootstrapPolicies.find((p) => p.l1Code === 'IT01')
      expect(it01?.rolloutState).toBe('legacy-primary')
      expect(it01?.primaryThreshold).toBe(0.72)
    })
  })
})
