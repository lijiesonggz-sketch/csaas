import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  buildTaxonomyBenchmarkMachineSummary,
  TaxonomyBenchmarkRunner,
} from './taxonomy-benchmark.runner'
import {
  TAXONOMY_BENCHMARK_AUTOMATE_EMPTY_SLICE_CASE_RESULTS,
  TAXONOMY_BENCHMARK_AUTOMATE_REASON_CASE,
  TAXONOMY_BENCHMARK_AUTOMATE_REQUESTED_DOMAINS,
} from '../testing/taxonomy-benchmark-automate.fixtures'

describe('TaxonomyBenchmarkRunner automation regression', () => {
  it('[P0][6.4-AUTO-001] should throw when requested domains include one without any discovered fixtures', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taxonomy-benchmark-missing-domain-'))

    fs.mkdirSync(path.join(tempDir, 'tier-0-smoke'), { recursive: true })
    fs.writeFileSync(
      path.join(tempDir, 'tier-0-smoke', 'it04-only.fixture.json'),
      JSON.stringify([
        {
          caseId: 'IT04-AUTO-ONLY',
          caseTitle: 'it04 only',
          caseText: 'EAST 数据质量不符合规范要求。',
          l1Code: 'IT04',
          tier: 'tier-0-smoke',
          riskTags: ['SMOKE'],
          expectedL2Code: 'IT04-04',
          expectedFailureModeCodes: [],
          expectedControlCodes: [],
        },
      ]),
      'utf8',
    )

    const runner = new TaxonomyBenchmarkRunner({
      fixtureBaseDir: tempDir,
      taxonomyClassifierService: { classifyCaseText: jest.fn() },
      failureModeService: { findByL2Code: jest.fn() },
      caseClusteringChainService: {
        resolveControlPointsByL2Code: jest.fn(),
      },
      controlPointService: { findByL2CodeWithFullChain: jest.fn() },
    })

    await expect(
      runner.runBenchmark({
        domainCodes: [...TAXONOMY_BENCHMARK_AUTOMATE_REQUESTED_DOMAINS],
        tiers: ['tier-0-smoke'],
        writeReport: false,
      }),
    ).rejects.toThrow('No fixtures for domains: IT07')
  })

  it('[P1][6.4-AUTO-002] should ignore mixed-tier cases from a fixture file when the selected tiers do not include them', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taxonomy-benchmark-mixed-tier-'))

    fs.mkdirSync(path.join(tempDir, 'tier-0-smoke'), { recursive: true })
    fs.writeFileSync(
      path.join(tempDir, 'tier-0-smoke', 'mixed-tier.fixture.json'),
      JSON.stringify([
        {
          caseId: 'IT04-SMOKE-A',
          caseTitle: 'smoke case',
          caseText: 'EAST 数据质量不符合规范要求。',
          l1Code: 'IT04',
          tier: 'tier-0-smoke',
          riskTags: ['SMOKE'],
          expectedL2Code: 'IT04-04',
          expectedFailureModeCodes: [],
          expectedControlCodes: [],
        },
        {
          caseId: 'IT04-CUTOVER-A',
          caseTitle: 'cutover case',
          caseText: '向监管提供虚假报表。',
          l1Code: 'IT04',
          tier: 'tier-1-cutover',
          riskTags: ['HIGH_RISK'],
          expectedL2Code: 'IT04-11',
          expectedFailureModeCodes: [],
          expectedControlCodes: [],
        },
      ]),
      'utf8',
    )

    const runner = new TaxonomyBenchmarkRunner({
      fixtureBaseDir: tempDir,
      taxonomyClassifierService: { classifyCaseText: jest.fn() },
      failureModeService: { findByL2Code: jest.fn() },
      caseClusteringChainService: {
        resolveControlPointsByL2Code: jest.fn(),
      },
      controlPointService: { findByL2CodeWithFullChain: jest.fn() },
    })

    const fixtures = runner.discoverFixtures({
      tiers: ['tier-0-smoke'],
      domainCodes: ['IT04'],
    })

    expect(fixtures).toHaveLength(1)
    expect(fixtures[0]).toEqual(
      expect.objectContaining({
        tier: 'tier-0-smoke',
        caseCount: 1,
      }),
    )
  })

  it('[P1][6.4-AUTO-003] should include expected vs actual control/evidence details in reasonSummary when taxonomy hits but downstream chain misses', async () => {
    const runner = new TaxonomyBenchmarkRunner({
      evaluateNewPathCase: () => ({
        l1Code: 'IT04',
        l2Code: 'IT04-04',
        l2Name: 'EAST数据质量不符合规范要求',
        score: 0.9,
        confidenceScore: 0.9,
        scoreGap: 0.2,
        decisionSource: 'rule',
        matchedSignals: ['EAST'],
        matchedPhrases: ['EAST 数据质量'],
        matchedTokens: ['east'],
        classifierVersion: 'taxonomy-classifier-6.3',
        mappingVersion: '2026-04-07',
        rulebookVersion: 'it04-rulebook-1.0.0',
        classifiedAt: '2026-04-25T10:40:00+08:00',
        pathDecision: 'PRIMARY_CHAIN',
        failureSemantics: null,
      }),
      failureModeService: {
        findByL2Code: jest.fn().mockResolvedValue({
          items: [{ failureModeCode: 'FM-DQ-001' }],
        }),
      },
      caseClusteringChainService: {
        resolveControlPointsByL2Code: jest.fn().mockResolvedValue({
          items: [],
          total: 0,
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
      benchmarkCases: [TAXONOMY_BENCHMARK_AUTOMATE_REASON_CASE],
      writeReport: false,
    })

    expect(report.caseResults[0].missCategory).toBe('control')
    expect(report.caseResults[0].reasonSummary).toContain('expected controls [CTRL-DQ-001]')
    expect(report.caseResults[0].reasonSummary).toContain('actual [none]')
  })

  it('[P1][6.4-AUTO-004] should mark empty domain-tier-mode slices explicitly in machine summary groups', () => {
    const summary = buildTaxonomyBenchmarkMachineSummary({
      generatedAt: '2026-04-25T10:45:00+08:00',
      mode: 'dual-path-compare',
      domains: ['IT04', 'IT07'],
      tiers: ['tier-0-smoke', 'tier-1-cutover'],
      caseResults: TAXONOMY_BENCHMARK_AUTOMATE_EMPTY_SLICE_CASE_RESULTS,
      summary: {
        totalCases: 1,
        taxonomyHitCount: 1,
        failureModeHitCount: 1,
        controlHitCount: 1,
        evidenceHitCount: 1,
        fullChainHitCount: 1,
        taxonomyPrecision: 1,
        taxonomyRecall: 1,
        taxonomyF1: 1,
        failureModeHitRate: 1,
        controlHitRate: 1,
        evidenceHitRate: 1,
        fullChainHitRate: 1,
        abstainCount: 0,
        abstainRate: 0,
        fallbackTriggerCount: 0,
        fallbackTriggerRate: 0,
        highRiskCaseCount: 0,
        highRiskFalseNegativeCount: 0,
        highRiskFalseNegativeRate: 0,
        missCategoryCounts: {
          taxonomy: 0,
          failure_mode: 0,
          control: 0,
          evidence: 0,
        },
        confusionMatrix: {},
      },
    })

    expect(summary.groups.IT07['tier-1-cutover']['dual-path-compare']).toEqual(
      expect.objectContaining({
        sampleCount: 0,
        gateStatus: 'FAIL',
        missingSlices: ['empty-slice'],
      }),
    )
  })

  it('[P1][6.4-AUTO-005] should treat failureSemantic drift as a compare disagreement even when l2Code and pathDecision stay the same', async () => {
    const runner = new TaxonomyBenchmarkRunner({
      evaluateNewPathCase: () => ({
        l1Code: 'IT07',
        l2Code: null,
        l2Name: null,
        score: 0,
        confidenceScore: 0,
        scoreGap: 0,
        decisionSource: 'none',
        matchedSignals: [],
        matchedPhrases: [],
        matchedTokens: [],
        classifierVersion: 'taxonomy-classifier-6.3',
        mappingVersion: '2026-04-07',
        rulebookVersion: 'it07-rulebook-1.0.0',
        classifiedAt: '2026-04-25T10:50:00+08:00',
        pathDecision: 'UNCLASSIFIED',
        failureSemantics: 'LOW_CONFIDENCE',
      }),
      evaluateLegacyPathCase: () => ({
        l1Code: 'IT07',
        l2Code: null,
        l2Name: null,
        score: 0,
        confidenceScore: 0,
        scoreGap: 0,
        decisionSource: 'none',
        matchedSignals: [],
        matchedPhrases: [],
        matchedTokens: [],
        classifierVersion: 'legacy-it07',
        mappingVersion: 'legacy',
        rulebookVersion: 'legacy-it07',
        classifiedAt: '2026-04-25T10:50:00+08:00',
        pathDecision: 'UNCLASSIFIED',
        failureSemantics: 'NO_MATCH',
      }),
      failureModeService: { findByL2Code: jest.fn().mockResolvedValue({ items: [] }) },
      caseClusteringChainService: {
        resolveControlPointsByL2Code: jest.fn().mockResolvedValue({
          items: [],
          total: 0,
        }),
      },
      controlPointService: {
        findByL2CodeWithFullChain: jest.fn().mockResolvedValue({
          l2Code: '',
          l2Name: '',
          failureModes: [],
        }),
      },
    })

    const report = await runner.runBenchmark({
      benchmarkCases: [
        {
          caseId: 'IT07-AUTO-DRIFT',
          caseTitle: 'semantic drift',
          caseText: '运维场景低置信 vs 无匹配。',
          l1Code: 'IT07',
          tier: 'tier-1-cutover',
          riskTags: ['HIGH_RISK'],
          expectedL2Code: 'IT07-06',
          expectedFailureModeCodes: [],
          expectedControlCodes: [],
        },
      ],
      mode: 'dual-path-compare',
      writeReport: false,
    })

    expect(report.compareSummary?.disagreementCount).toBe(1)
    expect(report.compareSummary?.disagreements[0]).toEqual(
      expect.objectContaining({
        compareOutcome: 'different',
      }),
    )
  })
})

