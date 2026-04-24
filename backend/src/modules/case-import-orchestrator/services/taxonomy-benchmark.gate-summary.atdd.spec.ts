import {
  TAXONOMY_BENCHMARK_ATDD_EXPECTED_CONFUSION_MATRIX,
  TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS,
  TAXONOMY_BENCHMARK_ATDD_EXPECTED_MISSING_SLICES,
  TAXONOMY_BENCHMARK_ATDD_MACHINE_SUMMARY_FIELDS,
} from '../testing/taxonomy-benchmark.atdd.fixtures'

describe('Story 6.4 - Taxonomy Benchmark Gate Summary (ATDD)', () => {
  it.skip(
    '[P0][6.4-UNIT-006] should produce a machine-readable gate summary grouped by domain, tier, and mode for story 6.5 consumption',
    async () => {
      const { buildTaxonomyBenchmarkMachineSummary } = require('./taxonomy-benchmark.runner')

      const summary = buildTaxonomyBenchmarkMachineSummary({
        generatedAt: '2026-04-25T09:35:00+08:00',
        mode: 'new-path',
        domains: ['IT04', 'IT07'],
        tiers: ['tier-0-smoke', 'tier-1-cutover'],
        summary: {
          ...TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS,
          confusionMatrix: TAXONOMY_BENCHMARK_ATDD_EXPECTED_CONFUSION_MATRIX,
        },
      })

      for (const field of TAXONOMY_BENCHMARK_ATDD_MACHINE_SUMMARY_FIELDS) {
        expect(summary).toHaveProperty(field)
      }

      expect(summary.metrics).toEqual(
        expect.objectContaining({
          taxonomyPrecision: TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS.taxonomyPrecision,
          taxonomyRecall: TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS.taxonomyRecall,
          taxonomyF1: TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS.taxonomyF1,
          fullChainHitRate: TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS.fullChainHitRate,
        }),
      )
      expect(summary.metrics.confusionMatrix).toEqual(
        TAXONOMY_BENCHMARK_ATDD_EXPECTED_CONFUSION_MATRIX,
      )
    },
  )

  it.skip(
    '[P1][6.4-UNIT-007] should fail cutover evidence when tier-1 or tier-2 slices are missing or when high-risk false negatives stay above threshold even if overall hit rate looks green',
    async () => {
      const { evaluateTaxonomyBenchmarkGate } = require('./taxonomy-benchmark.runner')

      const gateDecision = evaluateTaxonomyBenchmarkGate({
        metrics: TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS,
        thresholds: {
          highRiskFalseNegativeRate: 0.1,
          fullChainHitRate: 0.6,
        },
        missingSlices: [...TAXONOMY_BENCHMARK_ATDD_EXPECTED_MISSING_SLICES],
      })

      expect(gateDecision).toEqual(
        expect.objectContaining({
          gateStatus: 'FAIL',
          reasons: expect.arrayContaining([
            expect.stringContaining('tier-1-cutover/high-risk'),
            expect.stringContaining('tier-2-holdout/historical-fallback'),
            expect.stringContaining('high-risk false negative'),
          ]),
        }),
      )
    },
  )
})

