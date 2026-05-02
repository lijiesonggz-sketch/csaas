import * as fs from 'fs'
import { DomainRolloutPolicyService } from './taxonomy-classification/domain-rollout-policy.service'
import { TaxonomyDomainGateService } from './taxonomy-domain-gate.service'
import { TAXONOMY_ROLLOUT_POLICY_ATDD_MACHINE_SUMMARY } from '../testing/taxonomy-rollout-policy.atdd.fixtures'

describe('Story 8.2 - taxonomy domain gate service guardrails', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('[8.2-SVC-001][P1] should persist a bootstrap policy row before first operator-side gate/transition access', async () => {
    const mockRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => ({
        id: 'policy-it02',
        updatedAt: new Date('2026-05-02T00:00:00.000Z'),
        ...value,
      })),
    }

    const service = new DomainRolloutPolicyService(mockRepository as never)
    const policy = await service.getOrCreatePolicyForDomain('IT02')

    expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { l1Code: 'IT02' } })
    expect(mockRepository.save).toHaveBeenCalledTimes(1)
    expect(policy.l1Code).toBe('IT02')
    expect(policy.rolloutState).toBe('legacy-primary')
    expect(policy.activeClassifierVersion).toBeTruthy()
  })

  test('[8.2-SVC-002][P1] should surface concurrency conflict when rollout state changes between evaluation and update', async () => {
    const mockPolicyService = {
      getOrCreatePolicyForDomain: jest.fn().mockResolvedValue({
        l1Code: 'IT07',
        rolloutState: 'domain-shadow',
        allowLegacyFallback: true,
        primaryThreshold: 0.78,
        shadowWindowDays: 14,
        cutoverThresholdsJson: { errorBudget: 0.03 },
        retirementThresholdsJson: { fallbackRateMax: 0.05 },
        killSwitchEnabled: false,
        activeClassifierVersion: 'taxonomy-classifier-6.5',
        retirementEvidenceJson: null,
        updatedAt: new Date('2026-05-02T00:00:00.000Z'),
      }),
    }
    const mockRepository = {
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    }

    const service = new TaxonomyDomainGateService(
      mockPolicyService as never,
      mockRepository as never,
      undefined,
      undefined,
    )

    jest.spyOn(service, 'evaluateDomainReadiness').mockResolvedValue({
      l1Code: 'IT07',
      currentState: 'domain-shadow',
      targetState: 'domain-compare',
      allowed: true,
      gateStatus: 'PASS',
      blockingReasons: [],
      benchmarkGate: {
        gateStatus: 'PASS',
        sourceTier: 'tier-1-cutover',
        sourceMode: 'dual-path-compare',
      },
      metrics: {
        totalRuns: 42,
        fallbackCount: 1,
        unknownCount: 0,
        manualCorrectionCount: 1,
        fallbackRate: 0.0238,
        unknownRate: 0,
        manualCorrectionRate: 0.0238,
        errorBudgetConsumed: 0.0238,
        observationWindowDays: 14,
      },
      rolloutGuidance: {
        canaryPercentage: 10,
        errorBudget: 0.03,
        rollbackPath: 'Enable kill switch and revert rollout state',
      },
      recommendedNextAction: 'Promote to Compare',
    })

    await expect(
      service.transitionRolloutState({
        l1Code: 'IT07',
        targetState: 'domain-compare',
        updatedBy: '00000000-0000-0000-0000-000000000111',
      }),
    ).rejects.toThrow(/concurrency conflict/i)
    expect(mockRepository.update).toHaveBeenCalledWith(
      {
        l1Code: 'IT07',
        rolloutState: 'domain-shadow',
      },
      expect.objectContaining({
        rolloutState: 'domain-compare',
        updatedBy: '00000000-0000-0000-0000-000000000111',
      }),
    )
  })

  test('[8.2-SVC-003][P1] should expose benchmark gate details separately from runtime metrics in readiness decisions', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readdirSync').mockReturnValue(['taxonomy-benchmark-summary.json'] as never)
    jest.spyOn(fs, 'statSync').mockReturnValue({ mtime: new Date() } as never)
    jest
      .spyOn(fs, 'readFileSync')
      .mockReturnValue(JSON.stringify(TAXONOMY_ROLLOUT_POLICY_ATDD_MACHINE_SUMMARY) as never)

    const domainRolloutPolicyService = {
      getOrCreatePolicyForDomain: jest.fn().mockResolvedValue({
        id: null,
        l1Code: 'IT07',
        rolloutState: 'domain-shadow',
        allowLegacyFallback: true,
        primaryThreshold: 0.78,
        shadowWindowDays: 14,
        cutoverThresholdsJson: {
          canaryPercentage: 15,
          errorBudget: 1,
          rollbackPath: 'Enable kill switch and revert rollout state',
        },
        retirementThresholdsJson: {},
        killSwitchEnabled: false,
        activeClassifierVersion: 'taxonomy-classifier-6.4',
        mappingOwner: 'owner-a',
        rulebookOwner: 'owner-b',
        benchmarkOwner: 'owner-c',
        gateApprover: 'owner-d',
        rollbackApprover: 'owner-e',
        updatedAt: null,
        updatedBy: null,
      }),
    }
    const classificationRunRepository = {
      find: jest
        .fn()
        .mockResolvedValue([
          { caseId: 'case-1', pathDecision: 'PRIMARY_CHAIN', createdAt: new Date() },
        ]),
    }
    const complianceCaseRepository = {
      count: jest.fn().mockResolvedValue(0),
    }

    const service = new TaxonomyDomainGateService(
      domainRolloutPolicyService as never,
      undefined,
      classificationRunRepository as never,
      complianceCaseRepository as never,
    )

    const decision = await service.evaluateDomainReadiness({
      l1Code: 'IT07',
      targetState: 'domain-compare',
    })

    expect(decision.benchmarkGate).toEqual(
      expect.objectContaining({
        gateStatus: 'PASS',
        sourceTier: 'tier-2-holdout',
        sourceMode: 'dual-path-compare',
      }),
    )
    expect(decision.metrics).toEqual(
      expect.objectContaining({
        fallbackRate: 0,
        unknownRate: 0,
        manualCorrectionRate: 0,
        errorBudgetConsumed: 0,
      }),
    )
  })
})
