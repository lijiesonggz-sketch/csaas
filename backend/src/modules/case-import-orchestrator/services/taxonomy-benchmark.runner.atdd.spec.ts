import {
  TAXONOMY_BENCHMARK_ATDD_COMPARE_DISAGREEMENT,
  TAXONOMY_BENCHMARK_ATDD_DISCOVERY_FIXTURES,
  TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS,
  TAXONOMY_BENCHMARK_ATDD_EXPECTED_MODES,
  TAXONOMY_BENCHMARK_ATDD_EXPECTED_REPORT_COMPATIBILITY,
  TAXONOMY_BENCHMARK_ATDD_EXPECTED_TIERS,
  TAXONOMY_BENCHMARK_ATDD_FIXTURE_BASE_DIR,
} from '../testing/taxonomy-benchmark.atdd.fixtures'

describe('Story 6.4 - Taxonomy Benchmark Runner (ATDD)', () => {
  it.skip(
    '[P0][6.4-INT-001] should discover tier-0/tier-1/tier-2 fixture sets across runtime-ready domains instead of hardcoding the IT04 dataset',
    async () => {
      const { TaxonomyBenchmarkRunner } = require('./taxonomy-benchmark.runner')

      const runner = new TaxonomyBenchmarkRunner({
        fixtureBaseDir: TAXONOMY_BENCHMARK_ATDD_FIXTURE_BASE_DIR,
        taxonomyClassifierService: { classifyCaseText: jest.fn() },
        failureModeService: { findByL2Code: jest.fn() },
        caseClusteringChainService: {
          resolveControlPointsByL2Code: jest.fn(),
        },
        controlPointService: { findByL2CodeWithFullChain: jest.fn() },
      })

      const fixtures = await runner.discoverFixtures({
        tiers: [...TAXONOMY_BENCHMARK_ATDD_EXPECTED_TIERS],
        domainCodes: ['IT02', 'IT04', 'IT07'],
      })

      expect(fixtures).toEqual(
        expect.arrayContaining(
          TAXONOMY_BENCHMARK_ATDD_DISCOVERY_FIXTURES.map((fixture) =>
            expect.objectContaining({
              tier: fixture.tier,
              l1Code: fixture.l1Code,
              fixtureFile: fixture.fixtureFile,
              riskTags: fixture.riskTags,
            }),
          ),
        ),
      )
    },
  )

  it.skip(
    '[P0][6.4-INT-002] should run new-path benchmark through the runtime classifier stack and emit markdown/json output compatible with the current IT04 report shape',
    async () => {
      const { TaxonomyBenchmarkRunner } = require('./taxonomy-benchmark.runner')

      const taxonomyClassifierService = {
        classifyCaseText: jest.fn().mockReturnValue({
          l1Code: 'IT04',
          l2Code: 'IT04-04',
          l2Name: 'EAST数据质量不符合规范要求',
          score: 0.92,
          confidenceScore: 0.92,
          scoreGap: 0.2,
          decisionSource: 'rule',
          matchedSignals: ['EAST', '字段偏差'],
          matchedPhrases: ['EAST 数据质量'],
          matchedTokens: ['east', '质量'],
          classifierVersion: 'taxonomy-classifier-6.3',
          mappingVersion: '2026-04-07',
          rulebookVersion: 'it04-rulebook-1.0.0',
          classifiedAt: '2026-04-25T09:30:00+08:00',
          pathDecision: 'PRIMARY_CHAIN',
          failureSemantics: null,
        }),
      }

      const runner = new TaxonomyBenchmarkRunner({
        fixtureBaseDir: TAXONOMY_BENCHMARK_ATDD_FIXTURE_BASE_DIR,
        reportDir: '_bmad-output/test-artifacts',
        taxonomyClassifierService,
        failureModeService: {
          findByL2Code: jest.fn().mockResolvedValue({
            items: [{ failureModeCode: 'FM-DQ-001' }],
          }),
        },
        caseClusteringChainService: {
          resolveControlPointsByL2Code: jest.fn().mockResolvedValue({
            items: [{ controlCode: 'CTRL-DQ-001' }],
            total: 1,
          }),
        },
        controlPointService: {
          findByL2CodeWithFullChain: jest.fn().mockResolvedValue({
            l2Code: 'IT04-04',
            l2Name: 'EAST数据质量不符合规范要求',
            failureModes: [],
          }),
        },
      })

      const report = await runner.runBenchmark({
        mode: 'new-path',
        tiers: ['tier-0-smoke'],
        domainCodes: ['IT04'],
        writeReport: false,
      })

      expect(taxonomyClassifierService.classifyCaseText).toHaveBeenCalled()
      expect(report).toEqual(
        expect.objectContaining({
          reportId: TAXONOMY_BENCHMARK_ATDD_EXPECTED_REPORT_COMPATIBILITY.unifiedReportId,
          mode: 'new-path',
          summary: expect.objectContaining({
            taxonomyPrecision: TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS.taxonomyPrecision,
            fullChainHitRate: TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS.fullChainHitRate,
          }),
          compatibility: expect.objectContaining({
            legacyReportId: TAXONOMY_BENCHMARK_ATDD_EXPECTED_REPORT_COMPATIBILITY.legacyReportId,
            markdownTitle:
              TAXONOMY_BENCHMARK_ATDD_EXPECTED_REPORT_COMPATIBILITY.it04MarkdownTitle,
          }),
        }),
      )
    },
  )

  it.skip(
    '[P1][6.4-INT-003] should support new-path, legacy-path, and dual-path-compare modes without hiding the selected execution mode in fixture code',
    async () => {
      const { TaxonomyBenchmarkRunner } = require('./taxonomy-benchmark.runner')

      const runner = new TaxonomyBenchmarkRunner({
        fixtureBaseDir: TAXONOMY_BENCHMARK_ATDD_FIXTURE_BASE_DIR,
        taxonomyClassifierService: { classifyCaseText: jest.fn() },
        failureModeService: { findByL2Code: jest.fn() },
        caseClusteringChainService: {
          resolveControlPointsByL2Code: jest.fn(),
        },
        controlPointService: { findByL2CodeWithFullChain: jest.fn() },
        legacyBenchmarkRunner: {
          runBenchmark: jest.fn().mockResolvedValue({
            reportId: 'it04-benchmark',
          }),
        },
      })

      for (const mode of TAXONOMY_BENCHMARK_ATDD_EXPECTED_MODES) {
        const report = await runner.runBenchmark({
          mode,
          tiers: ['tier-1-cutover'],
          domainCodes: ['IT07'],
          writeReport: false,
        })

        expect(report.mode).toBe(mode)
      }
    },
  )

  it.skip(
    '[P1][6.4-INT-004] should emit dual-path disagreement cases with missCategory, failure semantics, and compare outcome for gate review',
    async () => {
      const { TaxonomyBenchmarkRunner } = require('./taxonomy-benchmark.runner')

      const runner = new TaxonomyBenchmarkRunner({
        fixtureBaseDir: TAXONOMY_BENCHMARK_ATDD_FIXTURE_BASE_DIR,
        taxonomyClassifierService: { classifyCaseText: jest.fn() },
        failureModeService: { findByL2Code: jest.fn() },
        caseClusteringChainService: {
          resolveControlPointsByL2Code: jest.fn(),
        },
        controlPointService: { findByL2CodeWithFullChain: jest.fn() },
        legacyBenchmarkRunner: {
          runBenchmark: jest.fn().mockResolvedValue({
            caseResults: [
              {
                caseId: TAXONOMY_BENCHMARK_ATDD_COMPARE_DISAGREEMENT.caseId,
                actualL2Code:
                  TAXONOMY_BENCHMARK_ATDD_COMPARE_DISAGREEMENT.legacyPath.l2Code,
                pathDecision:
                  TAXONOMY_BENCHMARK_ATDD_COMPARE_DISAGREEMENT.legacyPath.pathDecision,
              },
            ],
          }),
        },
      })

      const report = await runner.runBenchmark({
        mode: 'dual-path-compare',
        tiers: ['tier-1-cutover'],
        domainCodes: ['IT07'],
        writeReport: false,
      })

      expect(report.compareSummary.disagreements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            caseId: TAXONOMY_BENCHMARK_ATDD_COMPARE_DISAGREEMENT.caseId,
            missCategory:
              TAXONOMY_BENCHMARK_ATDD_COMPARE_DISAGREEMENT.missCategory,
            newPath: expect.objectContaining({
              pathDecision:
                TAXONOMY_BENCHMARK_ATDD_COMPARE_DISAGREEMENT.newPath.pathDecision,
            }),
            legacyPath: expect.objectContaining({
              pathDecision:
                TAXONOMY_BENCHMARK_ATDD_COMPARE_DISAGREEMENT.legacyPath.pathDecision,
            }),
          }),
        ]),
      )
    },
  )

  it.skip(
    '[P1][6.4-INT-005] should calculate high-risk false negative rate and fallback trigger rate from risk-tagged fixtures instead of only overall full-chain hits',
    async () => {
      const { TaxonomyBenchmarkRunner } = require('./taxonomy-benchmark.runner')

      const runner = new TaxonomyBenchmarkRunner({
        fixtureBaseDir: TAXONOMY_BENCHMARK_ATDD_FIXTURE_BASE_DIR,
        taxonomyClassifierService: { classifyCaseText: jest.fn() },
        failureModeService: { findByL2Code: jest.fn() },
        caseClusteringChainService: {
          resolveControlPointsByL2Code: jest.fn(),
        },
        controlPointService: { findByL2CodeWithFullChain: jest.fn() },
      })

      const report = await runner.runBenchmark({
        mode: 'new-path',
        tiers: ['tier-1-cutover', 'tier-2-holdout'],
        domainCodes: ['IT02', 'IT07'],
        writeReport: false,
      })

      expect(report.summary).toEqual(
        expect.objectContaining({
          highRiskFalseNegativeRate:
            TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS.highRiskFalseNegativeRate,
          fallbackTriggerRate:
            TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS.fallbackTriggerRate,
        }),
      )
    },
  )
})

