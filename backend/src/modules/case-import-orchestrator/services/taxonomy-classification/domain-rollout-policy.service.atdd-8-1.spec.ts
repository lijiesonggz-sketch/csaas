import { DomainRolloutPolicyService } from './domain-rollout-policy.service'
import {
  createMockRolloutPolicyRepository,
  createRepositoryPolicy,
  type RolloutPolicyRepositoryMock,
} from './domain-rollout-policy.test-helpers'

describe('DomainRolloutPolicyService - Story 8.1 list/detail ATDD', () => {
  let service: DomainRolloutPolicyService
  let mockRepository: RolloutPolicyRepositoryMock

  beforeEach(() => {
    mockRepository = createMockRolloutPolicyRepository()
    service = new DomainRolloutPolicyService(mockRepository as never)
  })

  describe('findAll (AC#1, AC#5)', () => {
    test('[8.1-SVCATDD-001][P0] should return all policies from DB when records exist', async () => {
      mockRepository.find.mockResolvedValue([
        createRepositoryPolicy({ l1Code: 'IT01' }),
        createRepositoryPolicy({
          l1Code: 'IT04',
          rolloutState: 'it04-on-new-interface',
          primaryThreshold: '0.7',
        }),
      ] as any)

      const result = await service.findAll()

      expect(result).toHaveLength(8)
      expect(result[0].l1Code).toBe('IT01')
      expect(result[3].l1Code).toBe('IT04')
      expect(result[3]).toMatchObject({
        rolloutState: 'it04-on-new-interface',
        primaryThreshold: 0.7,
      })
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { l1Code: 'ASC' },
      })
    })

    test('[8.1-SVCATDD-002][P0] should return bootstrap defaults when DB is empty', async () => {
      mockRepository.find.mockResolvedValue([])

      const result = await service.findAll()

      expect(result).toHaveLength(8)
      expect(result.map((p) => p.l1Code)).toEqual([
        'IT01',
        'IT02',
        'IT03',
        'IT04',
        'IT05',
        'IT06',
        'IT07',
        'IT08',
      ])
      const it04 = result.find((p) => p.l1Code === 'IT04')
      expect(it04?.rolloutState).toBe('it04-on-new-interface')
      const it07 = result.find((p) => p.l1Code === 'IT07')
      expect(it07?.rolloutState).toBe('domain-compare')
      const it01 = result.find((p) => p.l1Code === 'IT01')
      expect(it01?.rolloutState).toBe('legacy-primary')
    })

    test('[8.1-SVCATDD-003][P1] should return bootstrap defaults when repository is not available', async () => {
      const serviceWithoutRepo = new DomainRolloutPolicyService(undefined)

      const result = await serviceWithoutRepo.findAll()

      expect(result).toHaveLength(8)
      expect(result[0].l1Code).toBe('IT01')
    })

    test('[8.1-SVCATDD-004][P0] should merge partial DB policies with bootstrap defaults instead of returning a truncated list', async () => {
      mockRepository.find.mockResolvedValue([
        createRepositoryPolicy({
          l1Code: 'IT04',
          rolloutState: 'domain-primary',
          allowLegacyFallback: false,
          primaryThreshold: '0.81',
          shadowWindowDays: 30,
          killSwitchEnabled: false,
          activeClassifierVersion: 'v2.1',
          stateChangedAt: new Date('2026-02-01'),
          mappingOwner: 'team-rollout',
          rulebookOwner: 'team-rulebook',
          benchmarkOwner: 'team-benchmark',
          gateApprover: 'lead-1',
          rollbackApprover: 'lead-2',
        }),
      ] as any)

      const result = await service.findAll()

      expect(result).toHaveLength(8)
      expect(result.map((policy) => policy.l1Code)).toEqual([
        'IT01',
        'IT02',
        'IT03',
        'IT04',
        'IT05',
        'IT06',
        'IT07',
        'IT08',
      ])
      expect(result.find((policy) => policy.l1Code === 'IT04')).toMatchObject({
        rolloutState: 'domain-primary',
        allowLegacyFallback: false,
        primaryThreshold: 0.81,
        shadowWindowDays: 30,
        activeClassifierVersion: 'v2.1',
      })
      expect(result.find((policy) => policy.l1Code === 'IT01')).toMatchObject({
        rolloutState: 'legacy-primary',
      })
    })
  })

  describe('findByL1Code (AC#2, AC#5)', () => {
    test('[8.1-SVCATDD-005][P0] should return single policy by l1Code', async () => {
      mockRepository.findOne.mockResolvedValue(
        createRepositoryPolicy({
          l1Code: 'IT07',
          rolloutState: 'domain-compare',
          primaryThreshold: '0.78',
          mappingOwner: 'team-alpha',
          rulebookOwner: 'team-beta',
          benchmarkOwner: 'team-gamma',
          gateApprover: 'lead-1',
          rollbackApprover: 'lead-2',
          cutoverThresholdsJson: { canaryPercentage: 10 },
          retirementThresholdsJson: { fallbackRateMax: 0.05 },
          retirementEvidenceJson: { lastCutoverAt: '2026-01-10' },
          updatedBy: 'admin-1',
        }) as any,
      )

      const result = await service.findByL1Code('IT07')

      expect(result.l1Code).toBe('IT07')
      expect(result.rolloutState).toBe('domain-compare')
      expect(result.mappingOwner).toBe('team-alpha')
      expect(result.cutoverThresholdsJson).toHaveProperty('canaryPercentage')
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { l1Code: 'IT07' },
      })
    })

    test('[8.1-SVCATDD-006][P1] should return bootstrap fallback when DB lookup misses known domain', async () => {
      mockRepository.findOne.mockResolvedValue(null)

      const result = await service.findByL1Code('IT04')

      expect(result).not.toBeNull()
      expect(result!.l1Code).toBe('IT04')
      expect(result!.rolloutState).toBe('it04-on-new-interface')
    })

    test('[8.1-SVCATDD-007][P1] should return null for unknown domain not in bootstrap', async () => {
      mockRepository.findOne.mockResolvedValue(null)

      const result = await service.findByL1Code('INVALID')

      expect(result).toBeNull()
    })

    test('[8.1-SVCATDD-008][P1] should return bootstrap policy when repository is not available', async () => {
      const serviceWithoutRepo = new DomainRolloutPolicyService(undefined)

      const result = await serviceWithoutRepo.findByL1Code('IT01')

      expect(result).not.toBeNull()
      expect(result!.l1Code).toBe('IT01')
      expect(result!.rolloutState).toBe('legacy-primary')
    })
  })
})
