import {
  TAXONOMY_RETIREMENT_ATDD_EXPECTED_REPORT,
  TAXONOMY_RETIREMENT_ATDD_MISSING_PREREQUISITES,
  TAXONOMY_RETIREMENT_ATDD_READY_PREREQUISITES,
  TAXONOMY_RETIREMENT_ATDD_READY_RETIREMENT_GATE,
  TAXONOMY_RETIREMENT_ATDD_RELEASE_GUARD,
  TAXONOMY_RETIREMENT_ATDD_REQUIRED_PREREQUISITES,
  TAXONOMY_RETIREMENT_ATDD_REQUIRED_REPORT_FIELDS,
} from '../testing/taxonomy-retirement.atdd.fixtures'
import * as fs from 'fs'
import { TaxonomyDomainRetirementService } from './taxonomy-domain-retirement.service'

describe('Story 6.6 - Taxonomy Domain Retirement (ATDD)', () => {
  it('[P0][6.6-INT-001] should refuse legacy-off execution when kill-switch drill, rollback verification, or reclassify/backfill readiness evidence is missing even if metric gate passes', async () => {
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

    const service = new TaxonomyDomainRetirementService(gateService, prerequisiteVerifier)

    const decision = await service.evaluateRetirementReadiness({
      l1Code: 'IT07',
    })

    for (const field of TAXONOMY_RETIREMENT_ATDD_REQUIRED_PREREQUISITES) {
      expect(decision.prerequisites).toHaveProperty(field)
    }

    expect(decision.allowed).toBe(false)
    expect(decision.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('kill switch'),
        expect.stringContaining('rollback'),
        expect.stringContaining('reclassify'),
      ]),
    )
  })

  it('[P0][6.6-INT-002] should execute per-domain legacy-off, disable only that domain legacy path, and emit a retirement report without deleting audit or compatibility readers', async () => {
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
      removeAuditData: jest.fn(),
      removeBenchmarkCompatibility: jest.fn(),
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
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined)
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined)

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

    for (const field of TAXONOMY_RETIREMENT_ATDD_REQUIRED_REPORT_FIELDS) {
      expect(report).toHaveProperty(field)
    }

    expect(report).toEqual(expect.objectContaining(TAXONOMY_RETIREMENT_ATDD_EXPECTED_REPORT))
    expect(gateService.transitionRolloutState).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT07',
        targetState: 'legacy-off',
      }),
    )
    expect(legacyPathManager.disableDomainLegacyPath).toHaveBeenCalledWith('IT07', 'legacy-off')
    expect(legacyPathManager.removeAuditData).not.toHaveBeenCalled()
    expect(legacyPathManager.removeBenchmarkCompatibility).not.toHaveBeenCalled()
  })

  it('[P1][6.6-INT-003] should block physical cleanup for the first non-IT04 domain until a separate release and stable-window guard are satisfied', async () => {
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
          stableWindowDays: 14,
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
      ...TAXONOMY_RETIREMENT_ATDD_RELEASE_GUARD,
    })

    expect(decision.allowed).toBe(false)
    expect(decision.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('same release'),
        expect.stringContaining('stable window'),
      ]),
    )
  })
})
