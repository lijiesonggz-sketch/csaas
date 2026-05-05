import {
  TAXONOMY_RETIREMENT_ATDD_EXPECTED_REPORT,
  TAXONOMY_RETIREMENT_ATDD_MISSING_PREREQUISITES,
  TAXONOMY_RETIREMENT_ATDD_READY_PREREQUISITES,
  TAXONOMY_RETIREMENT_ATDD_READY_RETIREMENT_GATE,
  TAXONOMY_RETIREMENT_ATDD_RELEASE_GUARD,
} from '../testing/taxonomy-retirement.atdd.fixtures'
import { promises as fsPromises } from 'fs'
import { TaxonomyDomainRetirementService } from './taxonomy-domain-retirement.service'

describe('TaxonomyDomainRetirementService', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should refuse legacy-off execution when prerequisite evidence is missing', async () => {
    const gateService = {
      evaluateDomainReadiness: jest
        .fn()
        .mockResolvedValue(TAXONOMY_RETIREMENT_ATDD_READY_RETIREMENT_GATE),
    }
    const prerequisiteVerifier = {
      verifyPrerequisites: jest
        .fn()
        .mockResolvedValue(TAXONOMY_RETIREMENT_ATDD_MISSING_PREREQUISITES),
    }

    const service = new TaxonomyDomainRetirementService(
      gateService as never,
      prerequisiteVerifier as never,
    )

    const decision = await service.evaluateRetirementReadiness({
      l1Code: 'IT07',
    })

    expect(decision.allowed).toBe(false)
    expect(decision.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('kill switch'),
        expect.stringContaining('rollback'),
        expect.stringContaining('reclassify'),
      ]),
    )
  })

  it('should execute per-domain legacy-off and emit a retirement report', async () => {
    const gateService = {
      evaluateDomainReadiness: jest
        .fn()
        .mockResolvedValue(TAXONOMY_RETIREMENT_ATDD_READY_RETIREMENT_GATE),
      transitionRolloutState: jest.fn().mockResolvedValue(undefined),
    }
    const prerequisiteVerifier = {
      verifyPrerequisites: jest
        .fn()
        .mockResolvedValue(TAXONOMY_RETIREMENT_ATDD_READY_PREREQUISITES),
    }
    const legacyPathManager = {
      disableDomainLegacyPath: jest.fn().mockResolvedValue(undefined),
    }
    const smokeVerifier = {
      verifyDomainSmoke: jest.fn().mockResolvedValue({
        passed: true,
        checkedAt: TAXONOMY_RETIREMENT_ATDD_EXPECTED_REPORT.smokeVerification.checkedAt,
      }),
    }
    const releaseGuard = {
      evaluateCleanupReadiness: jest.fn().mockResolvedValue({
        allowed: false,
        blockingReasons: ['domain-primary stable window has not elapsed'],
      }),
    }
    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({
        l1Code: 'IT07',
        rolloutState: 'domain-primary',
        allowLegacyFallback: true,
        shadowWindowDays: 14,
        retirementThresholdsJson: {
          stableWindowDays: 14,
          rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
        },
        retirementEvidenceJson: {
          lastCutoverAt: '2026-04-01T00:00:00.000Z',
          lastCutoverReleaseId: 'kg-v2-r1',
        },
      }),
      listPolicies: jest.fn().mockResolvedValue([
        {
          l1Code: 'IT07',
          retirementEvidenceJson: {
            lastCutoverAt: '2026-04-01T00:00:00.000Z',
          },
        },
      ]),
    }
    const rolloutPolicyRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    }
    const writeFileSyncSpy = jest.spyOn(fsPromises, 'writeFile').mockResolvedValue(undefined)
    jest.spyOn(fsPromises, 'mkdir').mockResolvedValue(undefined)

    const service = new TaxonomyDomainRetirementService(
      gateService as never,
      prerequisiteVerifier as never,
      legacyPathManager as never,
      smokeVerifier as never,
      releaseGuard as never,
      domainRolloutPolicyService as never,
      rolloutPolicyRepository as never,
    )

    const report = await service.executeRetirement({
      l1Code: 'IT07',
      releaseId: 'kg-v2-r2',
    })

    expect(gateService.transitionRolloutState).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT07',
        targetState: 'legacy-off',
        releaseId: 'kg-v2-r2',
      }),
    )
    expect(legacyPathManager.disableDomainLegacyPath).toHaveBeenCalledWith('IT07', 'legacy-off')
    expect(rolloutPolicyRepository.update).toHaveBeenCalled()
    expect(writeFileSyncSpy).toHaveBeenCalled()
    expect(report).toEqual(expect.objectContaining(TAXONOMY_RETIREMENT_ATDD_EXPECTED_REPORT))
  })

  it('should block physical cleanup for the first non-IT04 domain in the same release', async () => {
    const releaseGuard = {
      evaluateCleanupReadiness: jest.fn().mockResolvedValue({
        allowed: false,
        blockingReasons: [
          'first non-IT04 domain cannot ship physical cleanup in the same release as first domain-primary cutover',
          'domain-primary stable window has not elapsed',
        ],
      }),
    }
    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({
        l1Code: 'IT07',
        retirementThresholdsJson: {
          stableWindowDays: TAXONOMY_RETIREMENT_ATDD_RELEASE_GUARD.stableWindowDays,
        },
        shadowWindowDays: 14,
        retirementEvidenceJson: {
          lastCutoverAt: TAXONOMY_RETIREMENT_ATDD_RELEASE_GUARD.retiredAt,
          lastCutoverReleaseId: TAXONOMY_RETIREMENT_ATDD_RELEASE_GUARD.currentReleaseId,
        },
      }),
      listPolicies: jest.fn().mockResolvedValue([
        {
          l1Code: 'IT07',
          retirementEvidenceJson: {
            lastCutoverAt: TAXONOMY_RETIREMENT_ATDD_RELEASE_GUARD.retiredAt,
          },
        },
      ]),
    }

    const service = new TaxonomyDomainRetirementService(
      undefined,
      undefined,
      undefined,
      undefined,
      releaseGuard as never,
      domainRolloutPolicyService as never,
    )

    const decision = await service.evaluatePhysicalCleanup({
      l1Code: 'IT07',
      currentReleaseId: 'kg-v2-r1',
    })

    expect(decision.allowed).toBe(false)
    expect(decision.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('same release'),
        expect.stringContaining('stable window'),
      ]),
    )
  })

  it('should rollback state and evidence when smoke verification fails', async () => {
    const originalPolicy = {
      l1Code: 'IT07',
      rolloutState: 'domain-primary',
      allowLegacyFallback: true,
      shadowWindowDays: 14,
      stateChangedAt: new Date('2026-04-01T00:00:00.000Z'),
      retirementThresholdsJson: {
        stableWindowDays: 14,
        rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
      },
      retirementEvidenceJson: {
        lastCutoverAt: '2026-04-01T00:00:00.000Z',
        lastCutoverReleaseId: 'kg-v2-r1',
        lastLegacyOffAt: null,
        lastLegacyOffReleaseId: null,
        lastKillSwitchDrillAt: null,
        lastRollbackVerifiedAt: null,
        lastReclassifyVerifiedAt: null,
        lastBackfillVerifiedAt: null,
        lastSmokeVerifiedAt: null,
        lastRetirementReportPath: null,
      },
    }
    const gateService = {
      evaluateDomainReadiness: jest
        .fn()
        .mockResolvedValue(TAXONOMY_RETIREMENT_ATDD_READY_RETIREMENT_GATE),
      transitionRolloutState: jest.fn().mockResolvedValue(undefined),
    }
    const prerequisiteVerifier = {
      verifyPrerequisites: jest
        .fn()
        .mockResolvedValue(TAXONOMY_RETIREMENT_ATDD_READY_PREREQUISITES),
    }
    const legacyPathManager = {
      disableDomainLegacyPath: jest.fn().mockResolvedValue(undefined),
      restoreDomainLegacyPath: jest.fn().mockResolvedValue(undefined),
    }
    const smokeVerifier = {
      verifyDomainSmoke: jest
        .fn()
        .mockResolvedValue({ passed: false, checkedAt: new Date().toISOString() }),
    }
    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue(originalPolicy),
      listPolicies: jest.fn().mockResolvedValue([]),
    }
    const rolloutPolicyRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    }

    const service = new TaxonomyDomainRetirementService(
      gateService as never,
      prerequisiteVerifier as never,
      legacyPathManager as never,
      smokeVerifier as never,
      undefined,
      domainRolloutPolicyService as never,
      rolloutPolicyRepository as never,
    )

    await expect(
      service.executeRetirement({ l1Code: 'IT07', releaseId: 'kg-v2-r2' }),
    ).rejects.toThrow('smoke verification failed')

    expect(gateService.transitionRolloutState).toHaveBeenCalledTimes(2)
    expect(gateService.transitionRolloutState).toHaveBeenLastCalledWith(
      expect.objectContaining({ targetState: 'domain-primary' }),
    )
    expect(legacyPathManager.restoreDomainLegacyPath).toHaveBeenCalledWith(
      'IT07',
      true,
      'domain-primary',
    )
    expect(rolloutPolicyRepository.update).toHaveBeenCalledWith(
      { l1Code: 'IT07', rolloutState: 'domain-primary' },
      expect.objectContaining({
        retirementEvidenceJson: originalPolicy.retirementEvidenceJson,
      }),
    )
  })

  it('should rollback legacy-off to domain-primary with state, fallback, and evidence in one policy update', async () => {
    const beforeRollbackPolicy = {
      l1Code: 'IT04',
      rolloutState: 'legacy-off',
      allowLegacyFallback: false,
      shadowWindowDays: 14,
      retirementThresholdsJson: {
        rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
      },
      retirementEvidenceJson: {
        lastRetirementReportPath: '/reports/taxonomy-retirement/IT04-rel.json',
        lastRollbackVerifiedAt: null,
      },
    }
    const afterRollbackPolicy = {
      ...beforeRollbackPolicy,
      rolloutState: 'domain-primary',
      allowLegacyFallback: true,
    }
    const domainRolloutPolicyService = {
      getPolicyForDomain: jest
        .fn()
        .mockResolvedValueOnce(beforeRollbackPolicy)
        .mockResolvedValueOnce(afterRollbackPolicy),
    }
    const rolloutPolicyRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    }

    const service = new TaxonomyDomainRetirementService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      domainRolloutPolicyService as never,
      rolloutPolicyRepository as never,
    )

    const result = await service.rollbackRetirement({
      l1Code: 'IT04',
      updatedBy: '00000000-0000-0000-0000-000000000111',
      restoreLegacyFallback: true,
    })

    expect(rolloutPolicyRepository.update).toHaveBeenCalledWith(
      { l1Code: 'IT04', rolloutState: 'legacy-off' },
      expect.objectContaining({
        rolloutState: 'domain-primary',
        allowLegacyFallback: true,
        updatedBy: '00000000-0000-0000-0000-000000000111',
        retirementEvidenceJson: expect.objectContaining({
          lastRetirementReportPath: '/reports/taxonomy-retirement/IT04-rel.json',
          lastRollbackVerifiedAt: expect.any(String),
        }),
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        previousState: 'legacy-off',
        targetState: 'domain-primary',
        legacyFallbackRestored: true,
        reportPath: '/reports/taxonomy-retirement/IT04-rel.json',
      }),
    )
  })

  it('should return a stable rollback blocked error on rollback concurrency conflict', async () => {
    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({
        l1Code: 'IT04',
        rolloutState: 'legacy-off',
        allowLegacyFallback: false,
        retirementThresholdsJson: {},
        retirementEvidenceJson: {},
      }),
    }
    const rolloutPolicyRepository = {
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    }
    const service = new TaxonomyDomainRetirementService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      domainRolloutPolicyService as never,
      rolloutPolicyRepository as never,
    )

    await expect(service.rollbackRetirement({ l1Code: 'IT04' })).rejects.toThrow(
      'Rollback blocked: concurrency conflict',
    )
  })

  it('should reject retirement report reads outside the allowed artifact directory', async () => {
    const service = new TaxonomyDomainRetirementService()

    await expect(service.readRetirementReport('D:\\csaas\\package.json')).rejects.toThrow(
      'Retirement report path is outside the allowed report directory.',
    )
  })

  it('should resolve public retirement report paths without exposing filesystem paths', async () => {
    const readFileSpy = jest.spyOn(fsPromises, 'readFile').mockResolvedValue('{"l1Code":"IT04"}')
    const service = new TaxonomyDomainRetirementService()

    const report = await service.readRetirementReport(
      '/reports/taxonomy-retirement/retirement-IT04-rel.json',
    )

    expect(readFileSpy).toHaveBeenCalledWith(
      expect.stringMatching(/taxonomy-retirement[\\/]retirement-IT04-rel\.json$/),
      'utf8',
    )
    expect(report).toEqual({
      fileName: 'retirement-IT04-rel.json',
      content: '{"l1Code":"IT04"}',
    })
  })
})
