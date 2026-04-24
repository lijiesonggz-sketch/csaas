import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  buildTaxonomyBenchmarkMachineSummary,
  evaluateTaxonomyBenchmarkGate,
  TaxonomyBenchmarkCase,
  TaxonomyBenchmarkRunner,
} from './taxonomy-benchmark.runner'
import {
  TAXONOMY_BENCHMARK_ATDD_DISCOVERY_FIXTURES,
  TAXONOMY_BENCHMARK_ATDD_EXPECTED_CONFUSION_MATRIX,
  TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS,
  TAXONOMY_BENCHMARK_ATDD_EXPECTED_MISSING_SLICES,
} from '../testing/taxonomy-benchmark.atdd.fixtures'

describe('TaxonomyBenchmarkRunner', () => {
  const fixtureBaseDir = path.resolve(
    process.cwd(),
    'src/modules/case-import-orchestrator/testing/benchmarks',
  )

  it('should discover tiered fixture sets from the benchmark directory', () => {
    const runner = new TaxonomyBenchmarkRunner({
      fixtureBaseDir,
      taxonomyClassifierService: { classifyCaseText: jest.fn() },
      failureModeService: { findByL2Code: jest.fn() },
      caseClusteringChainService: {
        resolveControlPointsByL2Code: jest.fn(),
      },
      controlPointService: { findByL2CodeWithFullChain: jest.fn() },
    })

    const fixtures = runner.discoverFixtures({
      tiers: ['tier-0-smoke', 'tier-1-cutover', 'tier-2-holdout'],
      domainCodes: ['IT02', 'IT04', 'IT07'],
    })

    expect(fixtures).toEqual(
      expect.arrayContaining(
        TAXONOMY_BENCHMARK_ATDD_DISCOVERY_FIXTURES.map((fixture) =>
          expect.objectContaining({
            tier: fixture.tier,
            l1Code: fixture.l1Code,
            fixtureFile: expect.stringContaining(
              path.basename(fixture.fixtureFile).replace(/\\/g, '/'),
            ),
          }),
        ),
      ),
    )

    const smokeDomains = runner
      .discoverFixtures({ tiers: ['tier-0-smoke'] })
      .map((fixture) => fixture.l1Code)
      .sort()
    expect(smokeDomains).toEqual([
      'IT01',
      'IT02',
      'IT03',
      'IT04',
      'IT05',
      'IT06',
      'IT07',
      'IT08',
    ])
  })

  it('should run new-path benchmark and write markdown/json/machine summary artifacts', async () => {
    const benchmarkCases: TaxonomyBenchmarkCase[] = [
      {
        caseId: 'IT04-BM-013',
        caseTitle: 'EAST 数据质量自动校验缺失',
        caseText:
          'EAST 数据质量不符合规范要求，报送前未建立自动化数据质量校验规则，异常字段未被阻断。',
        l1Code: 'IT04',
        tier: 'tier-1-cutover',
        riskTags: ['HIGH_RISK', 'HISTORICAL_FALLBACK'],
        expectedL2Code: 'IT04-04',
        expectedFailureModeCodes: ['FM-DQ-001'],
        expectedControlCodes: ['CTRL-DQ-001'],
        expectedEvidenceCodes: ['EVD-DQ-RULE-001'],
        expectedEvidenceCategories: ['LOG'],
      },
      {
        caseId: 'IT07-CUTOVER-003',
        caseTitle: '运维后台改数',
        caseText:
          '运维人员通过后台直接修改核心业务系统数据，绕过前台控制并缺少有效留痕。',
        l1Code: 'IT07',
        tier: 'tier-1-cutover',
        riskTags: ['HIGH_RISK'],
        expectedL2Code: 'IT07-06',
        expectedFailureModeCodes: [],
        expectedControlCodes: [],
      },
    ]

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taxonomy-benchmark-'))
    const taxonomyClassifierService = {
      classifyCaseText: jest.fn(
        ({
          preferredL1Code,
        }: {
          preferredL1Code?: string | null
        }) => {
          if (preferredL1Code === 'IT04') {
            return {
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
              classifiedAt: '2026-04-25T10:00:00+08:00',
              pathDecision: 'PRIMARY_CHAIN',
              failureSemantics: null,
            }
          }

          return {
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
            classifiedAt: '2026-04-25T10:00:00+08:00',
            pathDecision: 'UNCLASSIFIED',
            failureSemantics: 'LOW_CONFIDENCE',
          }
        },
      ),
    }

    const runner = new TaxonomyBenchmarkRunner({
      reportDir: tempDir,
      fixtureBaseDir,
      taxonomyClassifierService: taxonomyClassifierService as never,
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
          failureModes: [
            {
              failureModeId: 'fm-dq-001',
              failureModeCode: 'FM-DQ-001',
              name: '数据质量校验规则缺失',
              category: 'MISSING_CONTROL',
              controlPoints: [
                {
                  controlId: 'cp-dq-001',
                  controlCode: 'CTRL-DQ-001',
                  controlName: '数据质量自动化校验控制',
                  maturityLevel: 'hard',
                  authoritativeScore: 1,
                  relevance: 'PRIMARY',
                  evidenceTypes: [
                    {
                      evidenceId: 'evd-dq-001',
                      evidenceCode: 'EVD-DQ-RULE-001',
                      evidenceName: '数据质量校验日志',
                      evidenceCategory: 'LOG',
                      autoCollectable: true,
                      requiredLevel: 'REQUIRED',
                      frequency: 'DAILY',
                    },
                  ],
                },
              ],
            },
          ],
        }),
      },
    })

    const report = await runner.runBenchmark({
      mode: 'new-path',
      benchmarkCases,
      writeReport: true,
      reportFilePrefix: 'taxonomy-benchmark-report',
    })

    expect(report.summary.totalCases).toBe(2)
    expect(report.summary.taxonomyHitCount).toBe(1)
    expect(report.summary.fullChainHitCount).toBe(1)
    expect(report.summary.abstainCount).toBe(1)
    expect(report.summary.highRiskCaseCount).toBe(2)
    expect(report.summary.highRiskFalseNegativeCount).toBe(1)
    expect(report.summary.highRiskFalseNegativeRate).toBe(0.5)
    expect(report.summary.gateStatus).toBe('FAIL')
    expect(report.caseResults[1].reasonSummary).toContain(
      'classification ended with LOW_CONFIDENCE',
    )
    expect(report.markdownPath).toBeDefined()
    expect(report.jsonPath).toBeDefined()
    expect(report.machineSummaryPath).toBeDefined()
    expect(fs.existsSync(report.markdownPath!)).toBe(true)
    expect(fs.existsSync(report.jsonPath!)).toBe(true)
    expect(fs.existsSync(report.machineSummaryPath!)).toBe(true)

    const machineSummary = JSON.parse(
      fs.readFileSync(report.machineSummaryPath!, 'utf8'),
    ) as { reportId: string; metrics: { totalCases: number } }
    expect(machineSummary.reportId).toBe('taxonomy-benchmark')
    expect(machineSummary.metrics.totalCases).toBe(2)
  })

  it('should emit compare disagreements when new-path and legacy-path diverge', async () => {
    const benchmarkCases: TaxonomyBenchmarkCase[] = [
      {
        caseId: 'IT07-CUTOVER-003',
        caseTitle: '运维后台改数',
        caseText:
          '运维人员通过后台直接修改核心业务系统数据，绕过前台控制并缺少有效留痕。',
        l1Code: 'IT07',
        tier: 'tier-1-cutover',
        riskTags: ['HIGH_RISK', 'HISTORICAL_FALLBACK'],
        expectedL2Code: 'IT07-06',
        expectedFailureModeCodes: [],
        expectedControlCodes: [],
      },
    ]

    const runner = new TaxonomyBenchmarkRunner({
      fixtureBaseDir,
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
        classifiedAt: '2026-04-25T10:05:00+08:00',
        pathDecision: 'UNCLASSIFIED',
        failureSemantics: 'LOW_CONFIDENCE',
      }),
      evaluateLegacyPathCase: () => ({
        l1Code: 'IT07',
        l2Code: 'IT07-05',
        l2Name: '信息系统管控有效性不足',
        score: 0.81,
        confidenceScore: 0.81,
        scoreGap: 0.15,
        decisionSource: 'rule',
        matchedSignals: ['legacy-fallback'],
        matchedPhrases: ['legacy-fallback'],
        matchedTokens: ['legacy'],
        classifierVersion: 'legacy-it07',
        mappingVersion: 'legacy',
        rulebookVersion: 'legacy-it07',
        classifiedAt: '2026-04-25T10:05:00+08:00',
        pathDecision: 'LEGACY_FALLBACK',
        failureSemantics: 'LEGACY_FALLBACK_TRIGGERED',
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
          l2Code: 'IT07-05',
          l2Name: '信息系统管控有效性不足',
          failureModes: [],
        }),
      },
    })

    const report = await runner.runBenchmark({
      benchmarkCases,
      mode: 'dual-path-compare',
      writeReport: false,
    })

    expect(report.compareSummary?.disagreementCount).toBe(1)
    expect(report.compareSummary?.totalCompared).toBe(1)
    expect(report.compareSummary?.disagreements[0]).toEqual(
      expect.objectContaining({
        caseId: 'IT07-CUTOVER-003',
        compareOutcome: 'different',
        missCategory: 'taxonomy',
      }),
    )
  })

  it('should fail legacy-path runs when a selected fixture has no legacy evaluator', async () => {
    const benchmarkCases: TaxonomyBenchmarkCase[] = [
      {
        caseId: 'IT05-SMOKE-001',
        caseTitle: '外包准入尽调不足',
        caseText: '外包供应商准入尽调不充分，供应商日常监督和考核管理长期不到位。',
        l1Code: 'IT05',
        tier: 'tier-0-smoke',
        riskTags: ['SMOKE'],
        expectedL2Code: 'IT05-02',
        expectedFailureModeCodes: [],
        expectedControlCodes: [],
      },
    ]

    const runner = new TaxonomyBenchmarkRunner({
      evaluateNewPathCase: () => ({
        l1Code: 'IT05',
        l2Code: 'IT05-02',
        l2Name: '外包准入尽调/日常管理不到位',
        score: 0.8,
        confidenceScore: 0.8,
        scoreGap: 0.2,
        decisionSource: 'rule',
        matchedSignals: ['外包', '尽调'],
        matchedPhrases: ['外包供应商准入尽调'],
        matchedTokens: ['外包', '尽调'],
        classifierVersion: 'taxonomy-classifier-6.3',
        mappingVersion: '2026-04-07',
        rulebookVersion: 'it05-rulebook-1.0.0',
        classifiedAt: '2026-04-25T10:15:00+08:00',
        pathDecision: 'PRIMARY_CHAIN',
        failureSemantics: null,
      }),
      evaluateLegacyPathCase: () => null,
      failureModeService: { findByL2Code: jest.fn().mockResolvedValue({ items: [] }) },
      caseClusteringChainService: {
        resolveControlPointsByL2Code: jest.fn().mockResolvedValue({
          items: [],
          total: 0,
        }),
      },
      controlPointService: {
        findByL2CodeWithFullChain: jest.fn().mockResolvedValue({
          l2Code: 'IT05-02',
          l2Name: '外包准入尽调/日常管理不到位',
          failureModes: [],
        }),
      },
    })

    await expect(
      runner.runBenchmark({
        benchmarkCases,
        mode: 'legacy-path',
        writeReport: false,
      }),
    ).rejects.toThrow('Legacy path unavailable')
  })

  it('should count legacy-unavailable cases in compare summary instead of hiding them', async () => {
    const benchmarkCases: TaxonomyBenchmarkCase[] = [
      {
        caseId: 'IT05-COMPARE-001',
        caseTitle: '外包尽调 compare',
        caseText: '外包供应商准入尽调不充分，供应商日常监督和考核管理长期不到位。',
        l1Code: 'IT05',
        tier: 'tier-1-cutover',
        riskTags: ['HIGH_RISK'],
        expectedL2Code: 'IT05-02',
        expectedFailureModeCodes: [],
        expectedControlCodes: [],
      },
    ]

    const runner = new TaxonomyBenchmarkRunner({
      evaluateNewPathCase: () => ({
        l1Code: 'IT05',
        l2Code: 'IT05-02',
        l2Name: '外包准入尽调/日常管理不到位',
        score: 0.8,
        confidenceScore: 0.8,
        scoreGap: 0.2,
        decisionSource: 'rule',
        matchedSignals: ['外包', '尽调'],
        matchedPhrases: ['外包供应商准入尽调'],
        matchedTokens: ['外包', '尽调'],
        classifierVersion: 'taxonomy-classifier-6.3',
        mappingVersion: '2026-04-07',
        rulebookVersion: 'it05-rulebook-1.0.0',
        classifiedAt: '2026-04-25T10:20:00+08:00',
        pathDecision: 'PRIMARY_CHAIN',
        failureSemantics: null,
      }),
      evaluateLegacyPathCase: () => null,
      failureModeService: { findByL2Code: jest.fn().mockResolvedValue({ items: [] }) },
      caseClusteringChainService: {
        resolveControlPointsByL2Code: jest.fn().mockResolvedValue({
          items: [],
          total: 0,
        }),
      },
      controlPointService: {
        findByL2CodeWithFullChain: jest.fn().mockResolvedValue({
          l2Code: 'IT05-02',
          l2Name: '外包准入尽调/日常管理不到位',
          failureModes: [],
        }),
      },
    })

    const report = await runner.runBenchmark({
      benchmarkCases,
      mode: 'dual-path-compare',
      writeReport: false,
    })

    expect(report.compareSummary?.totalCompared).toBe(1)
    expect(report.compareSummary?.disagreements[0]).toEqual(
      expect.objectContaining({
        compareOutcome: 'legacy-unavailable',
      }),
    )
  })

  it('should build machine summary with stable fields', () => {
    const summary = buildTaxonomyBenchmarkMachineSummary({
      generatedAt: '2026-04-25T10:10:00+08:00',
      mode: 'new-path',
      domains: ['IT04', 'IT07'],
      tiers: ['tier-0-smoke', 'tier-1-cutover'],
      caseResults: [
        {
          caseId: 'IT04-1',
          caseTitle: 'it04',
          l1Code: 'IT04',
          tier: 'tier-0-smoke',
          riskTags: ['SMOKE'],
          expectedL2Code: 'IT04-04',
          actualL2Code: 'IT04-04',
          classificationDecisionSource: 'rule',
          classificationScoreGap: 0.2,
          pathDecision: 'PRIMARY_CHAIN',
          failureSemantic: null,
          taxonomyHit: true,
          failureModeHit: true,
          controlHit: true,
          evidenceHit: true,
          fullChainHit: true,
          missCategory: 'none',
          matchedClassifierSignals: ['EAST'],
          expectedFailureModeCodes: ['FM-DQ-001'],
          actualFailureModeCodes: ['FM-DQ-001'],
          expectedControlCodes: ['CTRL-DQ-001'],
          actualControlCodes: ['CTRL-DQ-001'],
          expectedEvidenceCodes: ['EVD-DQ-RULE-001'],
          actualEvidenceCodes: ['EVD-DQ-RULE-001'],
          expectedEvidenceCategories: ['LOG'],
          actualEvidenceCategories: ['LOG'],
          reasonSummary: 'full-chain benchmark expectations matched',
          highRiskFalseNegative: false,
          fallbackTriggered: false,
        },
      ],
      summary: {
        ...TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS,
        confusionMatrix: TAXONOMY_BENCHMARK_ATDD_EXPECTED_CONFUSION_MATRIX,
      },
    })

    expect(summary.metrics.taxonomyPrecision).toBe(
      TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS.taxonomyPrecision,
    )
    expect(summary.metrics.confusionMatrix).toEqual(
      TAXONOMY_BENCHMARK_ATDD_EXPECTED_CONFUSION_MATRIX,
    )
    expect(summary.groups.IT04['tier-0-smoke']['new-path'].sampleCount).toBe(1)
  })

  it('should fail gate on missing slices and high-risk false negatives', () => {
    const decision = evaluateTaxonomyBenchmarkGate({
      metrics: TAXONOMY_BENCHMARK_ATDD_EXPECTED_GATE_METRICS,
      thresholds: {
        highRiskFalseNegativeRate: 0.1,
        fullChainHitRate: 0.6,
      },
      missingSlices: [...TAXONOMY_BENCHMARK_ATDD_EXPECTED_MISSING_SLICES],
    })

    expect(decision).toEqual(
      expect.objectContaining({
        gateStatus: 'FAIL',
        reasons: expect.arrayContaining([
          expect.stringContaining('tier-1-cutover/high-risk'),
          expect.stringContaining('tier-2-holdout/historical-fallback'),
          expect.stringContaining('high-risk false negative'),
        ]),
      }),
    )
  })
})
