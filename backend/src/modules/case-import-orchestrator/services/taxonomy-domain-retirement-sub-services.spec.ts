import {
  DomainLegacyPathManagerService,
  DomainRetirementPrerequisiteVerifierService,
  DomainRetirementReleaseGuardService,
  DomainRetirementSmokeVerifierService,
} from './taxonomy-domain-retirement.service'

// ============================================================
// DomainRetirementPrerequisiteVerifierService
// ============================================================
describe('DomainRetirementPrerequisiteVerifierService', () => {
  const makeGateDecision = (overrides: Record<string, unknown> = {}) => ({
    l1Code: 'IT07',
    currentState: 'domain-primary',
    targetState: 'legacy-off',
    allowed: true,
    gateStatus: 'PASS',
    blockingReasons: [],
    metrics: {
      totalRuns: 20,
      fallbackCount: 0,
      unknownCount: 0,
      manualCorrectionCount: 0,
      fallbackRate: 0,
      unknownRate: 0,
      manualCorrectionRate: 0,
      errorBudgetConsumed: 0,
      observationWindowDays: 14,
    },
    rolloutGuidance: {
      canaryPercentage: 15,
      errorBudget: 0.05,
      rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
    },
    ...overrides,
  })

  it('should return all prerequisites false when no services are injected', async () => {
    const service = new DomainRetirementPrerequisiteVerifierService()
    const result = await service.verifyPrerequisites({
      l1Code: 'IT07',
      gateDecision: makeGateDecision() as never,
    })

    expect(result.killSwitchDrillPassed).toBe(false)
    expect(result.rollbackVerified).toBe(false)
    expect(result.reclassifyReady).toBe(false)
    expect(result.backfillReady).toBe(false)
  })

  it('should pass observationWindowPassed when totalRuns >= 10 and rates within budget', async () => {
    const service = new DomainRetirementPrerequisiteVerifierService()
    const result = await service.verifyPrerequisites({
      l1Code: 'IT07',
      gateDecision: makeGateDecision({
        metrics: {
          totalRuns: 15,
          fallbackCount: 0,
          unknownCount: 0,
          manualCorrectionCount: 0,
          fallbackRate: 0.01,
          unknownRate: 0.01,
          manualCorrectionRate: 0.01,
          errorBudgetConsumed: 0.01,
          observationWindowDays: 14,
        },
      }) as never,
    })

    expect(result.observationWindowPassed).toBe(true)
  })

  it('should fail observationWindowPassed when totalRuns < 10', async () => {
    const service = new DomainRetirementPrerequisiteVerifierService()
    const result = await service.verifyPrerequisites({
      l1Code: 'IT07',
      gateDecision: makeGateDecision({
        metrics: {
          totalRuns: 5,
          fallbackCount: 0,
          unknownCount: 0,
          manualCorrectionCount: 0,
          fallbackRate: 0,
          unknownRate: 0,
          manualCorrectionRate: 0,
          errorBudgetConsumed: 0,
          observationWindowDays: 14,
        },
      }) as never,
    })

    expect(result.observationWindowPassed).toBe(false)
  })

  it('should fail observationWindowPassed when unknownRate exceeds MAX_UNKNOWN_RATE', async () => {
    const service = new DomainRetirementPrerequisiteVerifierService()
    const result = await service.verifyPrerequisites({
      l1Code: 'IT07',
      gateDecision: makeGateDecision({
        metrics: {
          totalRuns: 20,
          fallbackCount: 0,
          unknownCount: 5,
          manualCorrectionCount: 0,
          fallbackRate: 0,
          unknownRate: 0.25,
          manualCorrectionRate: 0,
          errorBudgetConsumed: 0,
          observationWindowDays: 14,
        },
      }) as never,
    })

    expect(result.observationWindowPassed).toBe(false)
  })

  it('should pass cutoverTierPassed when currentState is domain-primary', async () => {
    const service = new DomainRetirementPrerequisiteVerifierService()
    const result = await service.verifyPrerequisites({
      l1Code: 'IT07',
      gateDecision: makeGateDecision({ currentState: 'domain-primary' }) as never,
    })

    expect(result.cutoverTierPassed).toBe(true)
  })

  it('should pass cutoverTierPassed when retirementEvidenceJson has lastCutoverAt', async () => {
    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({
        l1Code: 'IT07',
        rolloutState: 'domain-shadow',
        retirementEvidenceJson: {
          lastCutoverAt: '2026-04-01T00:00:00.000Z',
        },
        retirementThresholdsJson: { rollbackPath: 'revert' },
        rollbackApprover: 'admin',
        primaryThreshold: 0.7,
        activeClassifierVersion: 'v1',
        shadowWindowDays: 14,
      }),
      resolvePolicyDecision: jest.fn().mockResolvedValue({ pathDecision: 'LEGACY_FALLBACK' }),
    }
    const service = new DomainRetirementPrerequisiteVerifierService(
      domainRolloutPolicyService as never,
    )
    const result = await service.verifyPrerequisites({
      l1Code: 'IT07',
      gateDecision: makeGateDecision({ currentState: 'domain-shadow' }) as never,
    })

    expect(result.cutoverTierPassed).toBe(true)
  })

  it('should pass killSwitchDrillPassed when evidence has lastKillSwitchDrillAt', async () => {
    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({
        l1Code: 'IT07',
        rolloutState: 'domain-primary',
        retirementEvidenceJson: {
          lastKillSwitchDrillAt: '2026-04-20T00:00:00.000Z',
        },
        retirementThresholdsJson: { rollbackPath: 'revert' },
        rollbackApprover: 'admin',
        primaryThreshold: 0.7,
        activeClassifierVersion: 'v1',
        shadowWindowDays: 14,
      }),
      resolvePolicyDecision: jest.fn().mockResolvedValue({ pathDecision: 'LEGACY_FALLBACK' }),
    }
    const service = new DomainRetirementPrerequisiteVerifierService(
      domainRolloutPolicyService as never,
    )
    const result = await service.verifyPrerequisites({
      l1Code: 'IT07',
      gateDecision: makeGateDecision() as never,
    })

    expect(result.killSwitchDrillPassed).toBe(true)
  })
})

// ============================================================
// DomainLegacyPathManagerService
// ============================================================
describe('DomainLegacyPathManagerService', () => {
  it('should update allowLegacyFallback to false and verify the write', async () => {
    const rolloutPolicyRepository = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({ l1Code: 'IT07', allowLegacyFallback: false }),
    }
    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({ l1Code: 'IT07', allowLegacyFallback: true }),
    }
    const service = new DomainLegacyPathManagerService(
      domainRolloutPolicyService as never,
      rolloutPolicyRepository as never,
    )

    await service.disableDomainLegacyPath('IT07')

    expect(rolloutPolicyRepository.update).toHaveBeenCalledWith(
      { l1Code: 'IT07' },
      { allowLegacyFallback: false },
    )
  })

  it('should throw when allowLegacyFallback is still true after update', async () => {
    const rolloutPolicyRepository = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({ l1Code: 'IT07', allowLegacyFallback: true }),
    }
    const domainRolloutPolicyService = {
      getPolicyForDomain: jest.fn().mockResolvedValue({ l1Code: 'IT07', allowLegacyFallback: true }),
    }
    const service = new DomainLegacyPathManagerService(
      domainRolloutPolicyService as never,
      rolloutPolicyRepository as never,
    )

    await expect(service.disableDomainLegacyPath('IT07')).rejects.toThrow(
      'still allows legacy fallback',
    )
  })

  it('should restore allowLegacyFallback to the given value', async () => {
    const rolloutPolicyRepository = {
      update: jest.fn().mockResolvedValue(undefined),
    }
    const service = new DomainLegacyPathManagerService(
      undefined,
      rolloutPolicyRepository as never,
    )

    await service.restoreDomainLegacyPath('IT07', true)

    expect(rolloutPolicyRepository.update).toHaveBeenCalledWith(
      { l1Code: 'IT07' },
      { allowLegacyFallback: true },
    )
  })

  it('should be a no-op when repository is not injected', async () => {
    const service = new DomainLegacyPathManagerService()
    await expect(service.disableDomainLegacyPath('IT07')).resolves.toBeUndefined()
    await expect(service.restoreDomainLegacyPath('IT07', true)).resolves.toBeUndefined()
  })
})

// ============================================================
// DomainRetirementSmokeVerifierService
// ============================================================
describe('DomainRetirementSmokeVerifierService', () => {
  it('should return passed=false when any required service is missing', async () => {
    const service = new DomainRetirementSmokeVerifierService()
    const result = await service.verifyDomainSmoke('IT07')

    expect(result.passed).toBe(false)
    expect(result.checkedAt).toBeTruthy()
  })

  it('should return passed=false when no cases exist for the domain', async () => {
    const complianceCaseRepository = {
      find: jest.fn().mockResolvedValue([]),
    }
    const service = new DomainRetirementSmokeVerifierService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      complianceCaseRepository as never,
    )
    const result = await service.verifyDomainSmoke('IT07')

    expect(result.passed).toBe(false)
  })

  it('should classify infra errors separately from business failures', async () => {
    const complianceCaseRepository = {
      find: jest.fn().mockRejectedValue(new Error('ECONNREFUSED: connection refused')),
    }
    const service = new DomainRetirementSmokeVerifierService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      complianceCaseRepository as never,
    )
    const result = await service.verifyDomainSmoke('IT07')

    expect(result.passed).toBe(false)
    expect(result.reason).toContain('smoke-check-unavailable')
  })

  it('should return passed=true when all checks succeed', async () => {
    const complianceCaseRepository = {
      find: jest.fn().mockResolvedValue([
        { caseId: 'case-1', l1Code: 'IT07', createdAt: new Date() },
      ]),
    }
    const domainRolloutPolicyService = {
      shouldAllowLegacyFallback: jest.fn().mockResolvedValue(false),
      getPolicyForDomain: jest.fn().mockResolvedValue({ shadowWindowDays: 14 }),
    }
    const taxonomyDomainGateService = {
      summarizeWindow: jest.fn().mockResolvedValue({ totalRuns: 5 }),
    }
    const complianceCaseReclassificationService = {
      reclassify: jest.fn().mockResolvedValue({ caseCount: 1 }),
    }
    const complianceCaseBackfillService = {
      backfill: jest.fn().mockResolvedValue({ resetCount: 1, skippedMissingBatchCount: 0, rollbackCompatible: true }),
    }
    const service = new DomainRetirementSmokeVerifierService(
      domainRolloutPolicyService as never,
      taxonomyDomainGateService as never,
      complianceCaseReclassificationService as never,
      complianceCaseBackfillService as never,
      complianceCaseRepository as never,
    )
    const result = await service.verifyDomainSmoke('IT07')

    expect(result.passed).toBe(true)
    expect(result.checkedAt).toBeTruthy()
  })
})

// ============================================================
// DomainRetirementReleaseGuardService
// ============================================================
describe('DomainRetirementReleaseGuardService', () => {
  const service = new DomainRetirementReleaseGuardService()

  it('should allow cleanup when all conditions are met', async () => {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const result = await service.evaluateCleanupReadiness({
      l1Code: 'IT04',
      currentReleaseId: 'kg-v2-r3',
      isFirstNonIt04PrimaryDomain: false,
      retiredAt: pastDate,
      stableWindowDays: 14,
      lastCutoverAt: pastDate,
      lastCutoverReleaseId: 'kg-v2-r1',
    })

    expect(result.allowed).toBe(true)
    expect(result.blockingReasons).toHaveLength(0)
  })

  it('should block when retiredAt is null', async () => {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const result = await service.evaluateCleanupReadiness({
      l1Code: 'IT04',
      currentReleaseId: 'kg-v2-r3',
      isFirstNonIt04PrimaryDomain: false,
      retiredAt: null,
      stableWindowDays: 14,
      lastCutoverAt: pastDate,
      lastCutoverReleaseId: 'kg-v2-r1',
    })

    expect(result.allowed).toBe(false)
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([expect.stringContaining('legacy-off retirement first')]),
    )
  })

  it('should block when stable window has not elapsed', async () => {
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    const result = await service.evaluateCleanupReadiness({
      l1Code: 'IT04',
      currentReleaseId: 'kg-v2-r3',
      isFirstNonIt04PrimaryDomain: false,
      retiredAt: recentDate,
      stableWindowDays: 14,
      lastCutoverAt: recentDate,
      lastCutoverReleaseId: 'kg-v2-r1',
    })

    expect(result.allowed).toBe(false)
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([expect.stringContaining('stable window')]),
    )
  })

  it('should block first non-IT04 domain in same release as cutover', async () => {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const result = await service.evaluateCleanupReadiness({
      l1Code: 'IT07',
      currentReleaseId: 'kg-v2-r1',
      isFirstNonIt04PrimaryDomain: true,
      retiredAt: pastDate,
      stableWindowDays: 14,
      lastCutoverAt: pastDate,
      lastCutoverReleaseId: 'kg-v2-r1',
    })

    expect(result.allowed).toBe(false)
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([expect.stringContaining('same release')]),
    )
  })

  it('should handle NaN cutoverAt gracefully', async () => {
    const result = await service.evaluateCleanupReadiness({
      l1Code: 'IT04',
      currentReleaseId: 'kg-v2-r3',
      isFirstNonIt04PrimaryDomain: false,
      retiredAt: '2026-04-01T00:00:00.000Z',
      stableWindowDays: 14,
      lastCutoverAt: 'not-a-date',
      lastCutoverReleaseId: 'kg-v2-r1',
    })

    expect(result.allowed).toBe(false)
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([expect.stringContaining('cannot be verified')]),
    )
  })
})
