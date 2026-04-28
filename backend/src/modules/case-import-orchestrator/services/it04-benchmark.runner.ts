import * as fs from 'fs'
import { ControlPointService } from '../../knowledge-graph/services/control-point.service'
import { FailureModeService } from '../../knowledge-graph/services/failure-mode.service'
import { CaseClusteringChainService } from './case-clustering-chain.service'
import { CaseNormalizationService } from './taxonomy-classification/case-normalization.service'
import type { MappingRepository } from './taxonomy-classification/mapping-repository.interface'
import type {
  TaxonomyClassificationResult,
  TaxonomyMappingRecord,
} from './taxonomy-classification/contracts/classification-result.contract'
import { IT04_DOMAIN_PROFILE } from './taxonomy-classification/profiles/it04.profile'
import { TaxonomyClassifierEngine } from './taxonomy-classification/taxonomy-classifier.engine'
import { IT04_RULEBOOK } from './taxonomy-classification/rulebooks/it04.rulebook'
import {
  DEFAULT_TAXONOMY_BENCHMARK_REPORT_DIR,
  resolveWorkspaceArtifactPath,
  TaxonomyBenchmarkCase,
  TaxonomyBenchmarkCaseResult,
  TaxonomyBenchmarkRunner,
} from './taxonomy-benchmark.runner'

const DEFAULT_DATASET_RESOLUTION = resolveWorkspaceArtifactPath(
  'backend/src/modules/case-import-orchestrator/testing/it04-benchmark-cases.fixture.json',
)
const DEFAULT_DATASET_PATH = DEFAULT_DATASET_RESOLUTION.resolvedPath
const DEFAULT_REPORT_DIR = DEFAULT_TAXONOMY_BENCHMARK_REPORT_DIR
const DEFAULT_MIN_FULL_CHAIN_HITS = 10
const DEFAULT_CLASSIFIER_VERSION = 'taxonomy-classifier-6.1'
const defaultCaseNormalizationService = new CaseNormalizationService()
const defaultTaxonomyClassifierEngine = new TaxonomyClassifierEngine()

export type It04BenchmarkCase = {
  caseId: string
  caseTitle: string
  caseText: string
  expectedL2Code: string
  expectedFailureModeCodes: string[]
  expectedControlCodes: string[]
  expectedEvidenceCodes?: string[]
  expectedEvidenceCategories?: string[]
}

export type It04TaxonomySemanticMapping = TaxonomyMappingRecord

export type It04ClassificationResult = {
  l2Code: string | null
  l2Name: string | null
  score: number
  scoreGap: number
  decisionSource: 'rule' | 'semantic' | 'hybrid' | 'none'
  matchedPhrases: string[]
  matchedTokens: string[]
}

export type It04BenchmarkCaseResult = {
  caseId: string
  caseTitle: string
  expectedL2Code: string
  actualL2Code: string
  classificationDecisionSource: 'rule' | 'semantic' | 'hybrid' | 'none'
  classificationScoreGap: number
  taxonomyHit: boolean
  failureModeHit: boolean
  controlHit: boolean
  evidenceHit: boolean
  fullChainHit: boolean
  missCategory: 'taxonomy' | 'failure_mode' | 'control' | 'evidence' | 'none'
  matchedClassifierSignals: string[]
  expectedFailureModeCodes: string[]
  actualFailureModeCodes: string[]
  expectedControlCodes: string[]
  actualControlCodes: string[]
  expectedEvidenceCodes: string[]
  actualEvidenceCodes: string[]
  expectedEvidenceCategories: string[]
  actualEvidenceCategories: string[]
}

export type It04BenchmarkSummary = {
  totalCases: number
  taxonomyHitCount: number
  failureModeHitCount: number
  controlHitCount: number
  evidenceHitCount: number
  fullChainHitCount: number
  minFullChainHits: number
  meetsGate: boolean
  missCategoryCounts: Record<'taxonomy' | 'failure_mode' | 'control' | 'evidence', number>
}

export type It04BenchmarkReport = {
  generatedAt: string
  datasetPath: string
  taxonomyMappingPath: string
  classificationSource: string
  summary: It04BenchmarkSummary
  caseResults: It04BenchmarkCaseResult[]
  markdownPath?: string
  jsonPath?: string
}

type FailureModeServiceLike = Pick<FailureModeService, 'findByL2Code'>
type ControlPointServiceLike = Pick<ControlPointService, 'findByL2CodeWithFullChain'>
type CaseClusteringChainServiceLike = Pick<
  CaseClusteringChainService,
  'resolveControlPointsByL2Code'
>

function readRequiredFile(filePath: string, label: string, candidates: string[]): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Required ${label} file not found. Resolved path: ${filePath}. Tried candidates: ${candidates.join(
        ', ',
      )}`,
    )
  }

  return fs.readFileSync(filePath, 'utf8')
}

export function loadIt04BenchmarkCases(datasetPath = DEFAULT_DATASET_PATH): It04BenchmarkCase[] {
  const datasetCandidates =
    datasetPath === DEFAULT_DATASET_PATH ? DEFAULT_DATASET_RESOLUTION.candidates : [datasetPath]
  return JSON.parse(
    readRequiredFile(datasetPath, 'IT04 benchmark dataset', datasetCandidates),
  ) as It04BenchmarkCase[]
}

export function loadIt04TaxonomyMappings(
  mappingRepository: MappingRepository,
): It04TaxonomySemanticMapping[] {
  return mappingRepository.loadByL1Code('IT04')
}

function toLegacyIt04ClassificationResult(
  result: TaxonomyClassificationResult,
): It04ClassificationResult {
  return {
    l2Code: result.l2Code,
    l2Name: result.l2Name,
    score: result.score,
    scoreGap: result.scoreGap,
    decisionSource: result.decisionSource,
    matchedPhrases: result.matchedPhrases,
    matchedTokens: result.matchedTokens,
  }
}

function toTaxonomyClassificationResult(
  result: It04ClassificationResult,
  mappingVersion: string,
): TaxonomyClassificationResult {
  return {
    l1Code: 'IT04',
    l2Code: result.l2Code,
    l2Name: result.l2Name,
    score: result.score,
    confidenceScore: result.score,
    scoreGap: result.scoreGap,
    decisionSource: result.decisionSource,
    matchedSignals: [...result.matchedPhrases, ...result.matchedTokens],
    matchedPhrases: result.matchedPhrases,
    matchedTokens: result.matchedTokens,
    classifierVersion: DEFAULT_CLASSIFIER_VERSION,
    mappingVersion,
    rulebookVersion: IT04_RULEBOOK.version,
    classifiedAt: new Date().toISOString(),
    pathDecision: result.l2Code ? 'PRIMARY_CHAIN' : 'UNCLASSIFIED',
    failureSemantics: result.l2Code ? null : 'NO_MATCH',
  }
}

export function classifyIt04CaseText(
  caseText: string,
  mappings: It04TaxonomySemanticMapping[],
  mappingVersion = '2026-04-07',
): It04ClassificationResult {
  const normalizedInput = defaultCaseNormalizationService.normalize({
    rawText: caseText,
  })
  const result = defaultTaxonomyClassifierEngine.classify({
    input: normalizedInput,
    mappings,
    rulebook: IT04_RULEBOOK,
    activeProfile: IT04_DOMAIN_PROFILE,
    classifierVersion: DEFAULT_CLASSIFIER_VERSION,
    mappingVersion,
    classifiedAt: new Date().toISOString(),
  })

  return toLegacyIt04ClassificationResult(result)
}

export function buildIt04BenchmarkMarkdown(report: It04BenchmarkReport): string {
  const failingCases = report.caseResults.filter((result) => !result.fullChainHit)
  const lines = [
    '# IT04 Benchmark Report',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Dataset: ${report.datasetPath}`,
    `- Taxonomy mapping: ${report.taxonomyMappingPath}`,
    `- Classification source: ${report.classificationSource}`,
    '',
    '## Summary',
    '',
    `- Total cases: ${report.summary.totalCases}`,
    `- Taxonomy hits: ${report.summary.taxonomyHitCount}`,
    `- Failure mode hits: ${report.summary.failureModeHitCount}`,
    `- Control hits: ${report.summary.controlHitCount}`,
    `- Evidence hits: ${report.summary.evidenceHitCount}`,
    `- Full-chain hits: ${report.summary.fullChainHitCount}`,
    `- Gate: ${report.summary.meetsGate ? 'PASS' : 'FAIL'} (minimum ${report.summary.minFullChainHits})`,
    '',
    '## Miss Categories',
    '',
    `- Taxonomy: ${report.summary.missCategoryCounts.taxonomy}`,
    `- Failure mode: ${report.summary.missCategoryCounts.failure_mode}`,
    `- Control: ${report.summary.missCategoryCounts.control}`,
    `- Evidence: ${report.summary.missCategoryCounts.evidence}`,
    '',
    '## Full-Chain Hits',
    '',
    '| Case ID | Title | L2 | Controls | Evidence |',
    '| --- | --- | --- | --- | --- |',
    ...report.caseResults
      .filter((result) => result.fullChainHit)
      .map(
        (result) =>
          `| ${result.caseId} | ${result.caseTitle} | ${result.actualL2Code} | ${result.actualControlCodes.join(', ')} | ${result.actualEvidenceCodes.join(', ')} |`,
      ),
    '',
    '## Gaps',
    '',
    '| Case ID | Expected L2 | Actual L2 | Decision | Miss Category | Expected Controls | Actual Controls |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...failingCases.map(
      (result) =>
        `| ${result.caseId} | ${result.expectedL2Code} | ${result.actualL2Code} | ${result.classificationDecisionSource} (${result.classificationScoreGap}) | ${result.missCategory} | ${result.expectedControlCodes.join(', ')} | ${result.actualControlCodes.join(', ')} |`,
    ),
  ]

  return lines.join('\n')
}

export class It04BenchmarkRunner {
  constructor(
    private readonly services: {
      failureModeService: FailureModeServiceLike
      controlPointService: ControlPointServiceLike
      caseClusteringChainService: CaseClusteringChainServiceLike
      mappingRepository: MappingRepository
      datasetPath?: string
      reportDir?: string
    },
  ) {}

  async runBenchmark(options?: {
    writeReport?: boolean
    minFullChainHits?: number
  }): Promise<It04BenchmarkReport> {
    const datasetPath = this.services.datasetPath ?? DEFAULT_DATASET_PATH
    const benchmarkCases = loadIt04BenchmarkCases(datasetPath)
    const mappingRepository = this.services.mappingRepository
    const mappings = mappingRepository.loadByL1Code('IT04')
    const mappingVersion = mappingRepository.getVersion()
    const taxonomyRunner = new TaxonomyBenchmarkRunner({
      failureModeService: this.services.failureModeService,
      controlPointService: this.services.controlPointService,
      caseClusteringChainService: this.services.caseClusteringChainService,
      reportDir: this.services.reportDir ?? DEFAULT_REPORT_DIR,
      reportId: 'it04-benchmark',
      reportTitle: 'IT04 Benchmark Report',
      reportFilePrefix: 'it04-benchmark-report',
      compatibility: {
        legacyReportId: 'it04-benchmark',
        markdownTitle: 'IT04 Benchmark Report',
      },
      evaluateNewPathCase: (benchmarkCase: TaxonomyBenchmarkCase) =>
        toTaxonomyClassificationResult(
          classifyIt04CaseText(benchmarkCase.caseText, mappings, mappingVersion),
          mappingVersion,
        ),
    })

    const report = await taxonomyRunner.runBenchmark({
      mode: 'new-path',
      writeReport: options?.writeReport ?? true,
      benchmarkCases: benchmarkCases.map((benchmarkCase) => ({
        ...benchmarkCase,
        l1Code: 'IT04',
        tier: 'tier-0-smoke',
        riskTags: ['SMOKE'],
      })),
    })

    const minFullChainHits = options?.minFullChainHits ?? DEFAULT_MIN_FULL_CHAIN_HITS
    const legacySummary: It04BenchmarkSummary = {
      totalCases: report.summary.totalCases,
      taxonomyHitCount: report.summary.taxonomyHitCount,
      failureModeHitCount: report.summary.failureModeHitCount,
      controlHitCount: report.summary.controlHitCount,
      evidenceHitCount: report.summary.evidenceHitCount,
      fullChainHitCount: report.summary.fullChainHitCount,
      minFullChainHits,
      meetsGate: report.summary.fullChainHitCount >= minFullChainHits,
      missCategoryCounts: report.summary.missCategoryCounts,
    }

    const legacyReport: It04BenchmarkReport = {
      generatedAt: report.generatedAt,
      datasetPath,
      taxonomyMappingPath: `db:taxonomy_l2_runtime_profiles@${mappingVersion}`,
      classificationSource: 'hybrid IT04 rulebook + DB-backed runtime profile',
      summary: legacySummary,
      caseResults: report.caseResults.map((caseResult: TaxonomyBenchmarkCaseResult) => ({
        caseId: caseResult.caseId,
        caseTitle: caseResult.caseTitle,
        expectedL2Code: caseResult.expectedL2Code,
        actualL2Code: caseResult.actualL2Code,
        classificationDecisionSource: caseResult.classificationDecisionSource,
        classificationScoreGap: caseResult.classificationScoreGap,
        taxonomyHit: caseResult.taxonomyHit,
        failureModeHit: caseResult.failureModeHit,
        controlHit: caseResult.controlHit,
        evidenceHit: caseResult.evidenceHit,
        fullChainHit: caseResult.fullChainHit,
        missCategory: caseResult.missCategory,
        matchedClassifierSignals: caseResult.matchedClassifierSignals,
        expectedFailureModeCodes: caseResult.expectedFailureModeCodes,
        actualFailureModeCodes: caseResult.actualFailureModeCodes,
        expectedControlCodes: caseResult.expectedControlCodes,
        actualControlCodes: caseResult.actualControlCodes,
        expectedEvidenceCodes: caseResult.expectedEvidenceCodes,
        actualEvidenceCodes: caseResult.actualEvidenceCodes,
        expectedEvidenceCategories: caseResult.expectedEvidenceCategories,
        actualEvidenceCategories: caseResult.actualEvidenceCategories,
      })),
      markdownPath: report.markdownPath,
      jsonPath: report.jsonPath,
    }

    if (legacyReport.markdownPath) {
      fs.writeFileSync(legacyReport.markdownPath, buildIt04BenchmarkMarkdown(legacyReport), 'utf8')
    }
    if (legacyReport.jsonPath) {
      fs.writeFileSync(legacyReport.jsonPath, JSON.stringify(legacyReport, null, 2), 'utf8')
    }

    return legacyReport
  }
}
