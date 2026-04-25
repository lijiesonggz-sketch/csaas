import * as fs from 'fs'
import { TaxonomyDomainGateService } from './taxonomy-domain-gate.service'
import { TAXONOMY_ROLLOUT_POLICY_ATDD_MACHINE_SUMMARY } from '../testing/taxonomy-rollout-policy.atdd.fixtures'

describe('TaxonomyDomainGateService', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should summarize runtime fallback, unknown, and manual correction rates from the observation window', async () => {
    const classificationRunRepository = {
      find: jest.fn().mockResolvedValue([
        {
          caseId: 'case-1',
          pathDecision: 'PRIMARY_CHAIN',
          createdAt: new Date(),
        },
        {
          caseId: 'case-2',
          pathDecision: 'LEGACY_FALLBACK',
          createdAt: new Date(),
        },
        {
          caseId: 'case-3',
          pathDecision: 'UNCLASSIFIED',
          createdAt: new Date(),
        },
      ]),
    }
    const complianceCaseRepository = {
      count: jest.fn().mockResolvedValue(1),
    }

    const service = new TaxonomyDomainGateService(
      undefined,
      undefined,
      classificationRunRepository as never,
      complianceCaseRepository as never,
    )

    const metrics = await service.summarizeWindow('IT07', 14)

    expect(metrics).toEqual({
      totalRuns: 3,
      fallbackCount: 1,
      unknownCount: 1,
      manualCorrectionCount: 1,
      fallbackRate: 0.3333,
      unknownRate: 0.3333,
      manualCorrectionRate: 0.3333,
      errorBudgetConsumed: 0.3333,
      observationWindowDays: 14,
    })
  })

  it('should block legacy-off when the domain has not reached domain-primary even if benchmark evidence exists', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readdirSync').mockReturnValue(['taxonomy-benchmark-summary.json'] as never)
    jest.spyOn(fs, 'statSync').mockReturnValue({ mtime: new Date() } as never)
    jest
      .spyOn(fs, 'readFileSync')
      .mockReturnValue(JSON.stringify(TAXONOMY_ROLLOUT_POLICY_ATDD_MACHINE_SUMMARY) as never)

    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({
        id: null,
        l1Code: 'IT07',
        rolloutState: 'domain-compare',
        allowLegacyFallback: true,
        primaryThreshold: 0.78,
        shadowWindowDays: 14,
        cutoverThresholdsJson: {
          canaryPercentage: 15,
          errorBudget: 0.015,
          rollbackPath: 'Enable kill switch and revert rollout state',
        },
        retirementThresholdsJson: {
          fallbackRateMax: 0.03,
          unknownRateMax: 0.02,
          manualCorrectionRateMax: 0.08,
        },
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
      find: jest.fn().mockResolvedValue([
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
      targetState: 'legacy-off',
    })

    expect(decision.allowed).toBe(false)
    expect(decision.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Cannot skip rollout states'),
        expect.stringContaining('domain-primary'),
      ]),
    )
  })

  it('should fail readiness when the latest benchmark summary does not contain the requested domain', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readdirSync').mockReturnValue(['taxonomy-benchmark-summary.json'] as never)
    jest.spyOn(fs, 'statSync').mockReturnValue({ mtime: new Date() } as never)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        generatedAt: '2026-04-25T15:00:00+08:00',
        reportId: 'taxonomy-benchmark',
        mode: 'dual-path-compare',
        classifierVersion: 'taxonomy-classifier-6.4',
        metrics: {},
        groups: {
          IT04: {
            'tier-1-cutover': {
              'dual-path-compare': { gateStatus: 'PASS', metrics: {} },
            },
          },
        },
      }) as never,
    )

    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({
        id: null,
        l1Code: 'IT07',
        rolloutState: 'domain-shadow',
        allowLegacyFallback: true,
        primaryThreshold: 0.78,
        shadowWindowDays: 14,
        cutoverThresholdsJson: {
          canaryPercentage: 15,
          errorBudget: 0.5,
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
      find: jest.fn().mockResolvedValue([]),
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

    expect(decision.allowed).toBe(false)
    expect(decision.blockingReasons).toContain(
      'observation window has no runtime evidence',
    )
    expect(decision.blockingReasons).toContain(
      'benchmark gate is not PASS for target domain',
    )
  })

  it('should fail readiness when benchmark evidence is stale or bound to a different classifier version', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest
      .spyOn(fs, 'readdirSync')
      .mockReturnValue(['taxonomy-benchmark-summary.json'] as never)
    jest
      .spyOn(fs, 'statSync')
      .mockReturnValue({ mtime: new Date('2026-04-25T16:00:00+08:00') } as never)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        ...TAXONOMY_ROLLOUT_POLICY_ATDD_MACHINE_SUMMARY,
        generatedAt: '2026-04-01T10:00:00+08:00',
        classifierVersion: 'taxonomy-classifier-6.3',
      }) as never,
    )

    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({
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
      find: jest.fn().mockResolvedValue([
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

    expect(decision.allowed).toBe(false)
    expect(decision.blockingReasons).toContain(
      'benchmark gate is not PASS for target domain',
    )
  })

  it('should bind gate evaluation to rollout-state writes through transitionRolloutState', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readdirSync').mockReturnValue(['taxonomy-benchmark-summary.json'] as never)
    jest.spyOn(fs, 'statSync').mockReturnValue({ mtime: new Date() } as never)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify(TAXONOMY_ROLLOUT_POLICY_ATDD_MACHINE_SUMMARY) as never,
    )

    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({
        id: 'policy-1',
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
    const rolloutPolicyRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    }
    const classificationRunRepository = {
      find: jest.fn().mockResolvedValue([
        { caseId: 'case-1', pathDecision: 'PRIMARY_CHAIN', createdAt: new Date() },
      ]),
    }
    const complianceCaseRepository = {
      count: jest.fn().mockResolvedValue(0),
    }

    const service = new TaxonomyDomainGateService(
      domainRolloutPolicyService as never,
      rolloutPolicyRepository as never,
      classificationRunRepository as never,
      complianceCaseRepository as never,
    )

    const decision = await service.transitionRolloutState({
      l1Code: 'IT07',
      targetState: 'domain-compare',
      updatedBy: 'user-1',
    })

    expect(decision.allowed).toBe(true)
    expect(rolloutPolicyRepository.update).toHaveBeenCalledWith(
      { l1Code: 'IT07' },
      expect.objectContaining({
        rolloutState: 'domain-compare',
        updatedBy: 'user-1',
      }),
    )
  })
})
