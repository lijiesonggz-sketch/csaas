import {
  TAXONOMY_ROLLOUT_POLICY_ATDD_EXPECTED_CONTROL_PLANE_FIELDS,
  TAXONOMY_ROLLOUT_POLICY_ATDD_MACHINE_SUMMARY,
  TAXONOMY_ROLLOUT_POLICY_ATDD_RUNTIME_WINDOW,
} from '../testing/taxonomy-rollout-policy.atdd.fixtures'

describe('Story 6.5 - Taxonomy Domain Gate Control Plane (ATDD)', () => {
  it.skip(
    '[P0][6.5-INT-007] should evaluate readiness from benchmark summary and classification-run telemetry without allowing a domain to jump directly into legacy-off',
    async () => {
      const { TaxonomyDomainGateService } = require('./taxonomy-domain-gate.service')

      const benchmarkSummaryReader = {
        loadLatestSummary: jest
          .fn()
          .mockResolvedValue(TAXONOMY_ROLLOUT_POLICY_ATDD_MACHINE_SUMMARY),
      }
      const classificationRunMetricsReader = {
        summarizeWindow: jest
          .fn()
          .mockResolvedValue(TAXONOMY_ROLLOUT_POLICY_ATDD_RUNTIME_WINDOW),
      }

      const service = new TaxonomyDomainGateService(
        benchmarkSummaryReader,
        classificationRunMetricsReader,
      )

      const decision = await service.evaluateDomainReadiness({
        l1Code: 'IT07',
        currentState: 'domain-compare',
        targetState: 'legacy-off',
      })

      expect(decision).toEqual(
        expect.objectContaining({
          currentState: 'domain-compare',
          targetState: 'legacy-off',
          allowed: false,
          gateStatus: 'FAIL',
          blockingReasons: expect.arrayContaining([
            expect.stringContaining('domain-primary'),
          ]),
        }),
      )
    },
  )

  it.skip(
    '[P1][6.5-INT-008] should surface fallback, unknown, and manual-correction metrics together with canary and rollback guidance for rollout operators',
    async () => {
      const { TaxonomyDomainGateService } = require('./taxonomy-domain-gate.service')

      const benchmarkSummaryReader = {
        loadLatestSummary: jest
          .fn()
          .mockResolvedValue(TAXONOMY_ROLLOUT_POLICY_ATDD_MACHINE_SUMMARY),
      }
      const classificationRunMetricsReader = {
        summarizeWindow: jest
          .fn()
          .mockResolvedValue(TAXONOMY_ROLLOUT_POLICY_ATDD_RUNTIME_WINDOW),
      }

      const service = new TaxonomyDomainGateService(
        benchmarkSummaryReader,
        classificationRunMetricsReader,
      )

      const decision = await service.evaluateDomainReadiness({
        l1Code: 'IT07',
        currentState: 'domain-compare',
        targetState: 'domain-primary',
      })

      for (const field of TAXONOMY_ROLLOUT_POLICY_ATDD_EXPECTED_CONTROL_PLANE_FIELDS) {
        expect(decision).toHaveProperty(field)
      }

      expect(decision.metrics).toEqual(
        expect.objectContaining({
          fallbackRate:
            TAXONOMY_ROLLOUT_POLICY_ATDD_RUNTIME_WINDOW.fallbackRate,
          unknownRate: TAXONOMY_ROLLOUT_POLICY_ATDD_RUNTIME_WINDOW.unknownRate,
          manualCorrectionRate:
            TAXONOMY_ROLLOUT_POLICY_ATDD_RUNTIME_WINDOW.manualCorrectionRate,
        }),
      )
      expect(decision.rolloutGuidance).toEqual(
        expect.objectContaining({
          canaryPercentage: 15,
          errorBudget: 0.015,
          rollbackPath: expect.stringContaining('kill switch'),
        }),
      )
    },
  )
})
