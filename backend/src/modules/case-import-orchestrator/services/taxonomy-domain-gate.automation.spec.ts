import * as fs from 'fs'
import { TaxonomyDomainGateService } from './taxonomy-domain-gate.service'
import {
  TAXONOMY_ROLLOUT_POLICY_AUTOMATE_INVALID_MODE_SUMMARY,
  TAXONOMY_ROLLOUT_POLICY_AUTOMATE_INVALID_REPORT_SUMMARY,
  TAXONOMY_ROLLOUT_POLICY_AUTOMATE_VALID_SUMMARY,
} from '../testing/taxonomy-rollout-policy-automate.fixtures'

describe('TaxonomyDomainGateService automation regression', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('[P0][6.5-AUTO-003] should ignore newer non-taxonomy or non-compare artifacts and keep searching for the latest valid domain summary', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest
      .spyOn(fs, 'readdirSync')
      .mockReturnValue(
        [
          'zzz-invalid-report-summary.json',
          'yyy-invalid-mode-summary.json',
          'aaa-valid-taxonomy-summary.json',
        ] as never,
      )
    jest.spyOn(fs, 'statSync').mockImplementation(((target: string) => {
      const name = String(target)
      if (name.includes('zzz-invalid-report')) {
        return { mtime: new Date('2026-04-25T15:30:00+08:00') } as never
      }
      if (name.includes('yyy-invalid-mode')) {
        return { mtime: new Date('2026-04-25T15:20:00+08:00') } as never
      }
      return { mtime: new Date('2026-04-25T15:10:00+08:00') } as never
    }) as never)
    jest.spyOn(fs, 'readFileSync').mockImplementation(((target: string) => {
      const name = String(target)
      if (name.includes('zzz-invalid-report')) {
        return JSON.stringify(
          TAXONOMY_ROLLOUT_POLICY_AUTOMATE_INVALID_REPORT_SUMMARY,
        )
      }
      if (name.includes('yyy-invalid-mode')) {
        return JSON.stringify(
          TAXONOMY_ROLLOUT_POLICY_AUTOMATE_INVALID_MODE_SUMMARY,
        )
      }
      return JSON.stringify(TAXONOMY_ROLLOUT_POLICY_AUTOMATE_VALID_SUMMARY)
    }) as never)

    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({
        id: 'policy-it07',
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

    expect(decision.allowed).toBe(true)
    expect(decision.gateStatus).toBe('PASS')
  })

  it('[P1][6.5-AUTO-004] should refuse rollout-state writes when gate evaluation fails instead of updating the repository optimistically', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false)

    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({
        id: 'policy-it07',
        l1Code: 'IT07',
        rolloutState: 'domain-shadow',
        allowLegacyFallback: true,
        primaryThreshold: 0.78,
        shadowWindowDays: 14,
        cutoverThresholdsJson: {
          canaryPercentage: 15,
          errorBudget: 0.01,
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
      update: jest.fn(),
    }
    const classificationRunRepository = {
      find: jest.fn().mockResolvedValue([]),
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

    await expect(
      service.transitionRolloutState({
        l1Code: 'IT07',
        targetState: 'domain-compare',
        updatedBy: 'user-1',
      }),
    ).rejects.toThrow('Rollout transition blocked')
    expect(rolloutPolicyRepository.update).not.toHaveBeenCalled()
  })

  it('[P0][6.5-AUTO-007] should ignore newer stale or version-mismatched summaries and keep searching for the latest fresh summary for the active classifier', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest
      .spyOn(fs, 'readdirSync')
      .mockReturnValue(
        [
          'zzz-mismatched-version-summary.json',
          'yyy-stale-summary.json',
          'aaa-valid-taxonomy-summary.json',
        ] as never,
      )
    jest.spyOn(fs, 'statSync').mockImplementation(((target: string) => {
      const name = String(target)
      if (name.includes('zzz-mismatched-version')) {
        return { mtime: new Date('2026-04-25T15:40:00+08:00') } as never
      }
      if (name.includes('yyy-stale-summary')) {
        return { mtime: new Date('2026-04-25T15:30:00+08:00') } as never
      }
      return { mtime: new Date('2026-04-25T15:20:00+08:00') } as never
    }) as never)
    jest.spyOn(fs, 'readFileSync').mockImplementation(((target: string) => {
      const name = String(target)
      if (name.includes('zzz-mismatched-version')) {
        return JSON.stringify({
          ...TAXONOMY_ROLLOUT_POLICY_AUTOMATE_VALID_SUMMARY,
          generatedAt: '2026-04-25T15:39:00+08:00',
          classifierVersion: 'taxonomy-classifier-6.3',
        })
      }
      if (name.includes('yyy-stale-summary')) {
        return JSON.stringify({
          ...TAXONOMY_ROLLOUT_POLICY_AUTOMATE_VALID_SUMMARY,
          generatedAt: '2026-03-20T09:00:00+08:00',
        })
      }
      return JSON.stringify({
        ...TAXONOMY_ROLLOUT_POLICY_AUTOMATE_VALID_SUMMARY,
        generatedAt: '2026-04-25T15:10:00+08:00',
        classifierVersion: 'taxonomy-classifier-6.4',
      })
    }) as never)

    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({
        id: 'policy-it07',
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

    expect(decision.allowed).toBe(true)
    expect(decision.gateStatus).toBe('PASS')
  })
})
