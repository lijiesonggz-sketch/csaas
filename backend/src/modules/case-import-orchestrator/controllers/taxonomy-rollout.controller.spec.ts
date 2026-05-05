import { Test, TestingModule } from '@nestjs/testing'
import { TaxonomyRolloutController } from './taxonomy-rollout.controller'
import { DomainRolloutPolicyService } from '../services/taxonomy-classification/domain-rollout-policy.service'
import { TaxonomyDomainGateService } from '../services/taxonomy-domain-gate.service'
import { TaxonomyDomainRetirementService } from '../services/taxonomy-domain-retirement.service'
import { AuditLogService } from '../../audit/audit-log.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'

describe('TaxonomyRolloutController - Story 8.1', () => {
  let controller: TaxonomyRolloutController
  let mockService: jest.Mocked<DomainRolloutPolicyService>
  let mockGateService: jest.Mocked<TaxonomyDomainGateService>
  let mockRetirementService: jest.Mocked<TaxonomyDomainRetirementService>
  let mockAuditLogService: { log: jest.Mock }

  beforeEach(async () => {
    mockService = {
      findAll: jest.fn(),
      findByL1Code: jest.fn(),
      getReadinessSummary: jest.fn(),
      getOrCreatePolicyForDomain: jest.fn(),
    } as any
    mockGateService = {
      evaluateDomainReadiness: jest.fn(),
      transitionRolloutState: jest.fn(),
    } as any
    mockRetirementService = {
      evaluateRetirementReadiness: jest.fn(),
      evaluateRetirementDryRun: jest.fn(),
      executeRetirement: jest.fn(),
      rollbackRetirement: jest.fn(),
      readRetirementReport: jest.fn(),
    } as any
    mockAuditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaxonomyRolloutController],
      providers: [
        {
          provide: DomainRolloutPolicyService,
          useValue: mockService,
        },
        {
          provide: TaxonomyDomainGateService,
          useValue: mockGateService,
        },
        {
          provide: TaxonomyDomainRetirementService,
          useValue: mockRetirementService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
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

  describe('POST /gates/evaluate', () => {
    test('[8.2-CTRL-001][P0] should return a structured gate evaluation payload with policy summary', async () => {
      mockGateService.evaluateDomainReadiness.mockResolvedValue({
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
          totalRuns: 18,
          fallbackCount: 1,
          unknownCount: 0,
          manualCorrectionCount: 0,
          fallbackRate: 0.0556,
          unknownRate: 0,
          manualCorrectionRate: 0,
          errorBudgetConsumed: 0.0556,
          observationWindowDays: 14,
        },
        rolloutGuidance: {
          canaryPercentage: 10,
          errorBudget: 0.06,
          rollbackPath: 'Enable kill switch and revert rollout state',
        },
        recommendedNextAction:
          'Promote IT07 to domain-compare and keep monitoring rollback path Enable kill switch and revert rollout state.',
      })
      mockService.getOrCreatePolicyForDomain.mockResolvedValue({
        l1Code: 'IT07',
        rolloutState: 'domain-shadow',
        allowLegacyFallback: true,
        killSwitchEnabled: false,
        activeClassifierVersion: 'taxonomy-classifier-6.4',
        primaryThreshold: 0.78,
        shadowWindowDays: 14,
        stateChangedAt: new Date('2026-05-02T00:00:00.000Z'),
      } as any)

      const result = await controller.evaluateGate({
        l1Code: 'it07',
        targetState: 'domain-compare',
      } as any)

      expect(mockGateService.evaluateDomainReadiness).toHaveBeenCalledWith({
        l1Code: 'IT07',
        targetState: 'domain-compare',
      })
      expect(result).toEqual(
        expect.objectContaining({
          l1Code: 'IT07',
          gateStatus: 'PASS',
          benchmarkGate: expect.objectContaining({
            gateStatus: 'PASS',
            sourceTier: 'tier-1-cutover',
          }),
          policySummary: expect.objectContaining({
            l1Code: 'IT07',
            rolloutState: 'domain-shadow',
            killSwitchEnabled: false,
          }),
        }),
      )
    })
  })

  describe('POST /transitions', () => {
    test('[8.2-CTRL-002][P0] should map successful transitions to audit summary output', async () => {
      mockService.getOrCreatePolicyForDomain
        .mockResolvedValueOnce({
          l1Code: 'IT04',
          rolloutState: 'it04-on-new-interface',
          allowLegacyFallback: true,
          killSwitchEnabled: false,
          activeClassifierVersion: 'taxonomy-classifier-6.4',
          primaryThreshold: 0.7,
          shadowWindowDays: 14,
          stateChangedAt: null,
        } as any)
        .mockResolvedValueOnce({
          l1Code: 'IT04',
          rolloutState: 'domain-shadow',
          allowLegacyFallback: true,
          killSwitchEnabled: false,
          activeClassifierVersion: 'taxonomy-classifier-6.4',
          primaryThreshold: 0.7,
          shadowWindowDays: 14,
          stateChangedAt: new Date('2026-05-02T08:20:00.000Z'),
        } as any)
      mockGateService.transitionRolloutState.mockResolvedValue({
        l1Code: 'IT04',
        currentState: 'it04-on-new-interface',
        targetState: 'domain-shadow',
        allowed: true,
        gateStatus: 'PASS',
        blockingReasons: [],
        benchmarkGate: {
          gateStatus: 'PASS',
          sourceTier: 'tier-1-cutover',
          sourceMode: 'dual-path-compare',
        },
        metrics: {
          totalRuns: 30,
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
          canaryPercentage: 10,
          errorBudget: 0.02,
          rollbackPath: 'Enable kill switch and revert rollout state',
        },
        recommendedNextAction:
          'Promote IT04 to domain-shadow and keep monitoring rollback path Enable kill switch and revert rollout state.',
      })

      const result = await controller.transitionRolloutState(
        {
          l1Code: 'IT04',
          targetState: 'domain-shadow',
          releaseId: 'rel-8-2-001',
        } as any,
        { user: { id: 'admin-user-001' } } as any,
      )

      expect(mockGateService.transitionRolloutState).toHaveBeenCalledWith({
        l1Code: 'IT04',
        targetState: 'domain-shadow',
        updatedBy: 'admin-user-001',
        releaseId: 'rel-8-2-001',
      })
      expect(result).toEqual(
        expect.objectContaining({
          previousState: 'it04-on-new-interface',
          targetState: 'domain-shadow',
          operator: 'admin-user-001',
          auditSummary: expect.objectContaining({
            updatedBy: 'admin-user-001',
            releaseId: 'rel-8-2-001',
          }),
          policySummary: expect.objectContaining({
            rolloutState: 'domain-shadow',
          }),
        }),
      )
    })

    test('[8.2-CTRL-003][P1] should convert blocked transitions into ConflictException', async () => {
      mockService.getOrCreatePolicyForDomain.mockResolvedValue({
        l1Code: 'IT07',
        rolloutState: 'domain-compare',
        allowLegacyFallback: true,
        killSwitchEnabled: true,
        activeClassifierVersion: 'taxonomy-classifier-6.4',
        primaryThreshold: 0.78,
        shadowWindowDays: 14,
        stateChangedAt: null,
      } as any)
      mockGateService.transitionRolloutState.mockRejectedValue(
        new Error('Rollout transition blocked: runtime error budget exceeds cutover threshold'),
      )

      await expect(
        controller.transitionRolloutState(
          {
            l1Code: 'IT07',
            targetState: 'domain-primary',
          } as any,
          { user: { id: 'admin-user-001' } } as any,
        ),
      ).rejects.toThrow('Rollout transition blocked')
    })

    test('[8.3-CTRL-007][P1] should reject unsafe transition releaseId before gate mutation', async () => {
      await expect(
        controller.transitionRolloutState(
          {
            l1Code: 'IT04',
            targetState: 'domain-shadow',
            releaseId: ' bad release ',
          } as any,
          { user: { id: 'admin-user-001' } } as any,
        ),
      ).rejects.toThrow('releaseId must be 1-80 characters')

      expect(mockGateService.transitionRolloutState).not.toHaveBeenCalled()
    })
  })

  describe('POST /retirement/dry-run', () => {
    test('[8.3-CTRL-001][P0] should return structured retirement readiness with policy summary and latest execution metadata', async () => {
      mockRetirementService.evaluateRetirementDryRun.mockResolvedValue({
        l1Code: 'IT04',
        currentState: 'domain-primary',
        targetState: 'legacy-off',
        allowed: false,
        gateStatus: 'FAIL',
        prerequisites: {
          cutoverTierPassed: true,
          observationWindowPassed: true,
          killSwitchDrillPassed: false,
          rollbackVerified: true,
          reclassifyReady: true,
          backfillReady: false,
        },
        blockingReasons: ['kill switch drill has not been verified'],
        metrics: {
          totalRuns: 18,
          fallbackCount: 1,
          unknownCount: 0,
          manualCorrectionCount: 0,
          fallbackRate: 0.0556,
          unknownRate: 0,
          manualCorrectionRate: 0,
          errorBudgetConsumed: 0.0556,
          observationWindowDays: 14,
        },
        rolloutGuidance: {
          canaryPercentage: 10,
          errorBudget: 0.06,
          rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
        },
        cleanupReadiness: {
          allowed: false,
          blockingReasons: ['physical cleanup requires a completed legacy-off retirement first'],
        },
      } as any)
      mockService.getOrCreatePolicyForDomain.mockResolvedValue({
        l1Code: 'IT04',
        rolloutState: 'domain-primary',
        allowLegacyFallback: true,
        killSwitchEnabled: false,
        activeClassifierVersion: 'taxonomy-classifier-6.6',
        primaryThreshold: 0.7,
        shadowWindowDays: 14,
        stateChangedAt: new Date('2026-05-02T00:00:00.000Z'),
        retirementEvidenceJson: {
          lastLegacyOffAt: null,
          lastLegacyOffReleaseId: null,
          lastSmokeVerifiedAt: '2026-05-02T08:20:00.000Z',
          lastRollbackVerifiedAt: null,
          lastRetirementReportPath: '/reports/it04-retirement.json',
        },
      } as any)

      const result = await controller.evaluateRetirementDryRun(
        {
          l1Code: 'it04',
        } as any,
        { user: { id: 'admin-user-001' }, tenantId: 'tenant-1' } as any,
      )

      expect(mockRetirementService.evaluateRetirementDryRun).toHaveBeenCalledWith({
        l1Code: 'IT04',
      })
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'read',
          entityType: 'TaxonomyRolloutRetirement',
          tenantId: 'tenant-1',
          details: expect.objectContaining({
            operation: 'dry-run',
            l1Code: 'IT04',
          }),
        }),
      )
      expect(result).toEqual(
        expect.objectContaining({
          l1Code: 'IT04',
          gateStatus: 'FAIL',
          latestExecution: expect.objectContaining({
            lastRetirementReportPath: '/reports/it04-retirement.json',
          }),
          policySummary: expect.objectContaining({
            rolloutState: 'domain-primary',
          }),
        }),
      )
    })
  })

  describe('GET /retirement/report', () => {
    test('[8.3-CTRL-006][P1] should stream a report artifact through the audited report endpoint', async () => {
      mockRetirementService.readRetirementReport.mockResolvedValue({
        fileName: 'retirement-IT04-rel-8-3-001.json',
        content: '{"l1Code":"IT04"}',
      } as any)
      const response = {
        setHeader: jest.fn(),
        send: jest.fn(),
      }

      await controller.getRetirementReport(
        '/reports/taxonomy-retirement/retirement-IT04-rel-8-3-001.json',
        { user: { id: 'admin-user-001' }, tenantId: 'tenant-1' } as any,
        response as any,
      )

      expect(mockRetirementService.readRetirementReport).toHaveBeenCalledWith(
        '/reports/taxonomy-retirement/retirement-IT04-rel-8-3-001.json',
      )
      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8',
      )
      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename="retirement-IT04-rel-8-3-001.json"',
      )
      expect(response.send).toHaveBeenCalledWith('{"l1Code":"IT04"}')
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'read',
          entityType: 'TaxonomyRolloutRetirement',
          tenantId: 'tenant-1',
          details: expect.objectContaining({
            operation: 'report-view',
            outcome: 'success',
            fileName: 'retirement-IT04-rel-8-3-001.json',
          }),
        }),
      )
    })
  })

  describe('POST /retirement/execute', () => {
    test('[8.3-CTRL-002][P0] should map executeRetirement report into operator-facing response', async () => {
      mockService.getOrCreatePolicyForDomain
        .mockResolvedValueOnce({
          l1Code: 'IT04',
          rolloutState: 'domain-primary',
          allowLegacyFallback: true,
          killSwitchEnabled: false,
          activeClassifierVersion: 'taxonomy-classifier-6.6',
          primaryThreshold: 0.7,
          shadowWindowDays: 14,
          stateChangedAt: null,
        } as any)
        .mockResolvedValueOnce({
          l1Code: 'IT04',
          rolloutState: 'legacy-off',
          allowLegacyFallback: false,
          killSwitchEnabled: false,
          activeClassifierVersion: 'taxonomy-classifier-6.6',
          primaryThreshold: 0.7,
          shadowWindowDays: 14,
          stateChangedAt: new Date('2026-05-03T08:20:00.000Z'),
        } as any)
      mockRetirementService.executeRetirement.mockResolvedValue({
        finalFallbackRate: 0.0087,
        rollbackReadiness: {
          verified: true,
          path: 'Enable kill switch and revert rollout state to domain-primary',
        },
        smokeVerification: {
          passed: true,
          checkedAt: '2026-05-03T08:21:00.000Z',
        },
        blockingReasons: ['first non-IT04 cleanup requires a separate release'],
        gateResults: {
          legacyOff: 'PASS',
          cleanup: 'DEFERRED',
        },
        reportPath: '/reports/taxonomy-retirement/IT04-rel-8-3-001.json',
      } as any)

      const result = await controller.executeRetirement(
        {
          l1Code: 'IT04',
          releaseId: 'rel-8-3-001',
          confirmationText: 'IT04',
        } as any,
        { user: { id: 'admin-user-001' }, tenantId: 'tenant-1' } as any,
      )

      expect(mockRetirementService.executeRetirement).toHaveBeenCalledWith({
        l1Code: 'IT04',
        releaseId: 'rel-8-3-001',
        updatedBy: 'admin-user-001',
      })
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          entityType: 'TaxonomyRolloutRetirement',
          tenantId: 'tenant-1',
          details: expect.objectContaining({
            operation: 'execute',
            l1Code: 'IT04',
            releaseId: 'rel-8-3-001',
            outcome: 'success',
          }),
        }),
      )
      expect(result).toEqual(
        expect.objectContaining({
          previousState: 'domain-primary',
          targetState: 'legacy-off',
          operator: 'admin-user-001',
          reportPath: '/reports/taxonomy-retirement/IT04-rel-8-3-001.json',
          policySummary: expect.objectContaining({
            rolloutState: 'legacy-off',
            allowLegacyFallback: false,
          }),
        }),
      )
    })

    test('[8.3-CTRL-003][P1] should reject mismatched confirmationText', async () => {
      await expect(
        controller.executeRetirement(
          {
            l1Code: 'IT04',
            releaseId: 'rel-8-3-001',
            confirmationText: 'IT07',
          } as any,
          { user: { id: 'admin-user-001' } } as any,
        ),
      ).rejects.toThrow('confirmationText must exactly match the selected l1Code')
    })

    test('[8.3-CTRL-005][P1] should reject blank or unsafe releaseId before execution', async () => {
      await expect(
        controller.executeRetirement(
          {
            l1Code: 'IT04',
            releaseId: '   ',
            confirmationText: 'IT04',
          } as any,
          { user: { id: 'admin-user-001' } } as any,
        ),
      ).rejects.toThrow('releaseId must be 1-80 characters')
      expect(mockRetirementService.executeRetirement).not.toHaveBeenCalled()
    })
  })

  describe('POST /retirement/rollback', () => {
    test('[8.3-CTRL-004][P0] should map rollbackRetirement result into restored-state response', async () => {
      mockRetirementService.rollbackRetirement.mockResolvedValue({
        previousState: 'legacy-off',
        targetState: 'domain-primary',
        legacyFallbackRestored: true,
        rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
        reportPath: '/reports/taxonomy-retirement/IT04-rel-8-3-001.json',
        evidenceSummary: {
          lastRollbackVerifiedAt: '2026-05-03T08:30:00.000Z',
          lastRetirementReportPath: '/reports/taxonomy-retirement/IT04-rel-8-3-001.json',
        },
      } as any)
      mockService.getOrCreatePolicyForDomain.mockResolvedValue({
        l1Code: 'IT04',
        rolloutState: 'domain-primary',
        allowLegacyFallback: true,
        killSwitchEnabled: false,
        activeClassifierVersion: 'taxonomy-classifier-6.6',
        primaryThreshold: 0.7,
        shadowWindowDays: 14,
        stateChangedAt: new Date('2026-05-03T08:30:00.000Z'),
      } as any)

      const result = await controller.rollbackRetirement(
        {
          l1Code: 'IT04',
          targetState: 'domain-primary',
          confirmationText: 'IT04',
          restoreLegacyFallback: true,
        } as any,
        { user: { id: 'admin-user-001' }, tenantId: 'tenant-1' } as any,
      )

      expect(mockRetirementService.rollbackRetirement).toHaveBeenCalledWith({
        l1Code: 'IT04',
        targetState: 'domain-primary',
        updatedBy: 'admin-user-001',
        restoreLegacyFallback: true,
      })
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          entityType: 'TaxonomyRolloutRetirement',
          tenantId: 'tenant-1',
          details: expect.objectContaining({
            operation: 'rollback',
            l1Code: 'IT04',
            outcome: 'success',
          }),
        }),
      )
      expect(result).toEqual(
        expect.objectContaining({
          targetState: 'domain-primary',
          legacyFallbackRestored: true,
          rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
          policySummary: expect.objectContaining({
            rolloutState: 'domain-primary',
            allowLegacyFallback: true,
          }),
        }),
      )
    })
  })
})
