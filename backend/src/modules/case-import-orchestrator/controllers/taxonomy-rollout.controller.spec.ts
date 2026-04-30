import { Test, TestingModule } from '@nestjs/testing'
import { TaxonomyRolloutController } from './taxonomy-rollout.controller'
import { DomainRolloutPolicyService } from '../services/taxonomy-classification/domain-rollout-policy.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'

describe('TaxonomyRolloutController - Story 8.1', () => {
  let controller: TaxonomyRolloutController
  let mockService: jest.Mocked<DomainRolloutPolicyService>

  beforeEach(async () => {
    mockService = {
      findAll: jest.fn(),
      findByL1Code: jest.fn(),
      getReadinessSummary: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaxonomyRolloutController],
      providers: [
        {
          provide: DomainRolloutPolicyService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile()

    controller = module.get<TaxonomyRolloutController>(TaxonomyRolloutController)
  })

  describe('GET /policies', () => {
    test('[8.1-CTRL-001][P0] should return all domain rollout policies', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          l1Code: 'IT01',
          rolloutState: 'legacy-primary',
          allowLegacyFallback: true,
          killSwitchEnabled: false,
          activeClassifierVersion: 'v2.0',
          primaryThreshold: 0.72,
          shadowWindowDays: 14,
          stateChangedAt: null,
          mappingOwner: 'unassigned',
          rulebookOwner: 'unassigned',
          benchmarkOwner: 'unassigned',
          gateApprover: 'unassigned',
          rollbackApprover: 'unassigned',
        },
        {
          id: 'policy-2',
          l1Code: 'IT04',
          rolloutState: 'it04-on-new-interface',
          allowLegacyFallback: true,
          killSwitchEnabled: false,
          activeClassifierVersion: 'v2.0',
          primaryThreshold: 0.7,
          shadowWindowDays: 14,
          stateChangedAt: null,
          mappingOwner: 'unassigned',
          rulebookOwner: 'unassigned',
          benchmarkOwner: 'unassigned',
          gateApprover: 'unassigned',
          rollbackApprover: 'unassigned',
        },
      ]

      mockService.findAll.mockResolvedValue(mockPolicies as any)
      mockService.getReadinessSummary.mockReturnValue({
        stateAllowsPrimary: false,
        stateAllowsLegacyFallback: true,
        hasRetirementEvidence: false,
      })

      const result = await controller.getPolicies()

      expect(result).toHaveLength(2)
      expect(result[0].l1Code).toBe('IT01')
      expect(result[1].l1Code).toBe('IT04')
      expect(mockService.findAll).toHaveBeenCalledTimes(1)
    })

    test('[8.1-CTRL-002][P0] should return policies with all required fields per AC#1', async () => {
      mockService.findAll.mockResolvedValue([
        {
          id: 'policy-1',
          l1Code: 'IT01',
          rolloutState: 'legacy-primary',
          allowLegacyFallback: true,
          killSwitchEnabled: false,
          activeClassifierVersion: 'v2.0',
          primaryThreshold: 0.72,
          shadowWindowDays: 14,
          stateChangedAt: new Date('2026-01-15'),
        },
      ] as any)
      mockService.getReadinessSummary.mockReturnValue({
        stateAllowsPrimary: true,
        stateAllowsLegacyFallback: true,
        hasRetirementEvidence: true,
      })

      const result = await controller.getPolicies()
      const policy = result[0]

      // AC#1: l1Code, rolloutState, allowLegacyFallback, killSwitchEnabled
      expect(policy).toHaveProperty('l1Code')
      expect(policy).toHaveProperty('rolloutState')
      expect(policy).toHaveProperty('allowLegacyFallback')
      expect(policy).toHaveProperty('killSwitchEnabled')
      // AC#1: activeClassifierVersion, primaryThreshold, shadowWindowDays, stateChangedAt
      expect(policy).toHaveProperty('activeClassifierVersion')
      expect(policy).toHaveProperty('primaryThreshold')
      expect(policy).toHaveProperty('shadowWindowDays')
      expect(policy).toHaveProperty('stateChangedAt')
      expect(policy).toHaveProperty('stateAllowsPrimary', true)
      expect(policy).toHaveProperty('stateAllowsLegacyFallback', true)
      expect(policy).toHaveProperty('hasRetirementEvidence', true)
    })
  })

  describe('GET /policies/:l1Code', () => {
    test('[8.1-CTRL-003][P0] should return single domain policy detail', async () => {
      const mockPolicy = {
        id: 'policy-1',
        l1Code: 'IT04',
        rolloutState: 'it04-on-new-interface',
        allowLegacyFallback: true,
        killSwitchEnabled: false,
        activeClassifierVersion: 'v2.0',
        primaryThreshold: 0.7,
        shadowWindowDays: 14,
        stateChangedAt: new Date('2026-01-15'),
        mappingOwner: 'team-alpha',
        rulebookOwner: 'team-beta',
        benchmarkOwner: 'team-gamma',
        gateApprover: 'lead-1',
        rollbackApprover: 'lead-2',
        cutoverThresholdsJson: { canaryPercentage: 10, errorBudget: 0.02 },
        retirementThresholdsJson: { fallbackRateMax: 0.05 },
        retirementEvidenceJson: {
          lastCutoverAt: null,
          lastKillSwitchDrillAt: null,
          lastRetirementReportPath: null,
        },
      }

      mockService.findByL1Code.mockResolvedValue(mockPolicy as any)
      mockService.getReadinessSummary.mockReturnValue({
        stateAllowsPrimary: true,
        stateAllowsLegacyFallback: true,
        hasRetirementEvidence: true,
      })

      const result = await controller.getPolicyByL1Code('IT04')

      expect(result.l1Code).toBe('IT04')
      expect(result.rolloutState).toBe('it04-on-new-interface')
      expect(mockService.findByL1Code).toHaveBeenCalledWith('IT04')
    })

    test('[8.1-CTRL-004][P0] should return ownership fields per AC#2', async () => {
      const mockPolicy = {
        id: 'policy-1',
        l1Code: 'IT07',
        rolloutState: 'domain-compare',
        mappingOwner: 'team-alpha',
        rulebookOwner: 'team-beta',
        benchmarkOwner: 'team-gamma',
        gateApprover: 'lead-1',
        rollbackApprover: 'lead-2',
        cutoverThresholdsJson: { canaryPercentage: 10 },
        retirementThresholdsJson: { fallbackRateMax: 0.05 },
        retirementEvidenceJson: { lastCutoverAt: '2026-01-10' },
      }

      mockService.findByL1Code.mockResolvedValue(mockPolicy as any)
      mockService.getReadinessSummary.mockReturnValue({
        stateAllowsPrimary: false,
        stateAllowsLegacyFallback: true,
        hasRetirementEvidence: true,
      })

      const result = await controller.getPolicyByL1Code('IT07')

      // AC#2: ownership fields
      expect(result).toHaveProperty('mappingOwner')
      expect(result).toHaveProperty('rulebookOwner')
      expect(result).toHaveProperty('benchmarkOwner')
      expect(result).toHaveProperty('gateApprover')
      expect(result).toHaveProperty('rollbackApprover')
      // AC#2: thresholds and evidence
      expect(result).toHaveProperty('cutoverThresholdsJson')
      expect(result).toHaveProperty('retirementThresholdsJson')
      expect(result).toHaveProperty('retirementEvidenceJson')
      expect(result).toHaveProperty('stateAllowsPrimary', false)
      expect(result).toHaveProperty('stateAllowsLegacyFallback', true)
      expect(result).toHaveProperty('hasRetirementEvidence', true)
    })

    test('[8.1-CTRL-005][P1] should throw 404 for unknown l1Code', async () => {
      mockService.findByL1Code.mockResolvedValue(null)

      await expect(controller.getPolicyByL1Code('IT99')).rejects.toThrow(
        'No rollout policy found for domain IT99',
      )
      expect(mockService.findByL1Code).toHaveBeenCalledWith('IT99')
    })
  })
})
