import * as fs from 'fs'
import * as path from 'path'
import { ControlPointService, FullChainResult } from '../../knowledge-graph/services/control-point.service'
import { FailureModeService } from '../../knowledge-graph/services/failure-mode.service'
import { CaseClusteringChainService, ChainResult } from './case-clustering-chain.service'
import { CaseNormalizationService } from './taxonomy-classification/case-normalization.service'
import type {
  TaxonomyClassificationResult,
  TaxonomyMappingRecord,
} from './taxonomy-classification/contracts/classification-result.contract'
import { CsvBackedMappingRepository } from './taxonomy-classification/csv-backed-mapping.repository'
import { TaxonomyClassifierEngine } from './taxonomy-classification/taxonomy-classifier.engine'
import {
  IT04_DOMAIN_PROFILE,
} from './taxonomy-classification/rulebooks/it04.rulebook'
import { IT04_RULEBOOK } from './taxonomy-classification/rulebooks/it04.rulebook'

function resolveExistingPath(candidates: string[]): string {
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  return found ?? candidates[0]
}

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

function resolveWorkspaceArtifactPath(relativePath: string): {
  resolvedPath: string
  candidates: string[]
} {
  const normalizedRelativePath = relativePath.replace(/\//g, path.sep)
  const candidates = [
    path.resolve(process.cwd(), normalizedRelativePath),
    path.resolve(process.cwd(), '..', normalizedRelativePath),
    path.resolve(__dirname, '../../../../../', normalizedRelativePath),
    path.resolve(__dirname, '../../../../../../', normalizedRelativePath),
  ]

  return {
    resolvedPath: resolveExistingPath(candidates),
    candidates,
  }
}

const DEFAULT_DATASET_RESOLUTION = resolveWorkspaceArtifactPath(
  'backend/src/modules/case-import-orchestrator/testing/it04-benchmark-cases.fixture.json',
)
const DEFAULT_TAXONOMY_MAPPING_RESOLUTION = resolveWorkspaceArtifactPath(
  'docs/it-taxonomy-to-kg-semantic-mapping-2026-04-07.csv',
)
const DEFAULT_REPORT_DIR_RESOLUTION = resolveWorkspaceArtifactPath('_bmad-output/test-artifacts')

const DEFAULT_DATASET_PATH = DEFAULT_DATASET_RESOLUTION.resolvedPath
const DEFAULT_TAXONOMY_MAPPING_PATH = DEFAULT_TAXONOMY_MAPPING_RESOLUTION.resolvedPath
const DEFAULT_REPORT_DIR = DEFAULT_REPORT_DIR_RESOLUTION.resolvedPath
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
  decisionSource: 'rule' | 'semantic' | 'none'
  matchedPhrases: string[]
  matchedTokens: string[]
}

export type It04BenchmarkCaseResult = {
  caseId: string
  caseTitle: string
  expectedL2Code: string
  actualL2Code: string
  classificationDecisionSource: 'rule' | 'semantic' | 'none'
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
type CaseClusteringChainServiceLike = Pick<CaseClusteringChainService, 'resolveControlPointsByL2Code'>

function normalizeText(value: string): string {
  return value.replace(/\s+/g, '').trim()
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)))
}

function splitPipeList(value?: string): string[] {
  return dedupe(
    (value ?? '')
      .split('|')
      .map((entry) => normalizeText(entry))
      .filter((entry) => entry.length > 0),
  )
}

export function loadIt04BenchmarkCases(datasetPath = DEFAULT_DATASET_PATH): It04BenchmarkCase[] {
  const datasetCandidates =
    datasetPath === DEFAULT_DATASET_PATH ? DEFAULT_DATASET_RESOLUTION.candidates : [datasetPath]
  return JSON.parse(
    readRequiredFile(datasetPath, 'IT04 benchmark dataset', datasetCandidates),
  ) as It04BenchmarkCase[]
}

export function loadIt04TaxonomyMappings(
  taxonomyMappingPath = DEFAULT_TAXONOMY_MAPPING_PATH,
): It04TaxonomySemanticMapping[] {
  return new CsvBackedMappingRepository({
    mappingPath: taxonomyMappingPath,
  }).loadByL1Code('IT04')
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

function collectActualControlCodes(chainResult: ChainResult): string[] {
  return dedupe(chainResult.items.map((item) => item.controlCode))
}

function collectActualEvidence(
  fullChainResult: FullChainResult,
  expectedControlCodes: string[],
): { codes: string[]; categories: string[] } {
  const relevantControls = new Set(expectedControlCodes)
  const evidenceRows = fullChainResult.failureModes.flatMap((failureMode) =>
    failureMode.controlPoints
      .filter((controlPoint) =>
        relevantControls.size === 0 ? true : relevantControls.has(controlPoint.controlCode),
      )
      .flatMap((controlPoint) => controlPoint.evidenceTypes),
  )

  return {
    codes: dedupe(evidenceRows.map((evidence) => evidence.evidenceCode)),
    categories: dedupe(
      evidenceRows
        .map((evidence) => evidence.evidenceCategory ?? '')
        .filter((category) => category.length > 0),
    ),
  }
}

function includesAll(actual: string[], expected: string[]): boolean {
  if (expected.length === 0) {
    return true
  }

  const actualSet = new Set(actual)
  return expected.every((expectedValue) => actualSet.has(expectedValue))
}

function determineMissCategory(
  taxonomyHit: boolean,
  failureModeHit: boolean,
  controlHit: boolean,
  evidenceHit: boolean,
): It04BenchmarkCaseResult['missCategory'] {
  if (!taxonomyHit) {
    return 'taxonomy'
  }
  if (!failureModeHit) {
    return 'failure_mode'
  }
  if (!controlHit) {
    return 'control'
  }
  if (!evidenceHit) {
    return 'evidence'
  }

  return 'none'
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
      datasetPath?: string
      taxonomyMappingPath?: string
      reportDir?: string
    },
  ) {}

  async runBenchmark(options?: {
    writeReport?: boolean
    minFullChainHits?: number
  }): Promise<It04BenchmarkReport> {
    const datasetPath = this.services.datasetPath ?? DEFAULT_DATASET_PATH
    const taxonomyMappingPath = this.services.taxonomyMappingPath ?? DEFAULT_TAXONOMY_MAPPING_PATH
    const benchmarkCases = loadIt04BenchmarkCases(datasetPath)
    const mappingRepository = new CsvBackedMappingRepository({
      mappingPath: taxonomyMappingPath,
    })
    const mappings = mappingRepository.loadByL1Code('IT04')
    const mappingVersion = mappingRepository.getVersion()

    const caseResults: It04BenchmarkCaseResult[] = []

    for (const benchmarkCase of benchmarkCases) {
      const classification = classifyIt04CaseText(
        benchmarkCase.caseText,
        mappings,
        mappingVersion,
      )
      const failureModeResult =
        classification.l2Code == null
          ? { items: [] }
          : await this.services.failureModeService.findByL2Code(classification.l2Code, {
              status: 'ACTIVE',
              limit: 50,
            })

      const chainResult =
        classification.l2Code == null
          ? { items: [], total: 0 }
          : await this.services.caseClusteringChainService.resolveControlPointsByL2Code(
              classification.l2Code,
            )
      const fullChainResult =
        classification.l2Code == null
          ? { l2Code: '', l2Name: '', failureModes: [] }
          : await this.services.controlPointService.findByL2CodeWithFullChain(
              classification.l2Code,
            )

      const actualFailureModeCodes = dedupe(
        failureModeResult.items.map((failureMode) => failureMode.failureModeCode),
      )
      const actualControlCodes = collectActualControlCodes(chainResult as ChainResult)
      const actualEvidence = collectActualEvidence(
        fullChainResult as FullChainResult,
        benchmarkCase.expectedControlCodes,
      )

      const taxonomyHit = classification.l2Code === benchmarkCase.expectedL2Code
      const failureModeHit = includesAll(
        actualFailureModeCodes,
        benchmarkCase.expectedFailureModeCodes,
      )
      const controlHit = includesAll(actualControlCodes, benchmarkCase.expectedControlCodes)
      const expectedEvidenceCodes = benchmarkCase.expectedEvidenceCodes ?? []
      const expectedEvidenceCategories = benchmarkCase.expectedEvidenceCategories ?? []
      const evidenceHit =
        includesAll(actualEvidence.codes, expectedEvidenceCodes) &&
        includesAll(actualEvidence.categories, expectedEvidenceCategories)
      const fullChainHit = taxonomyHit && failureModeHit && controlHit && evidenceHit

      caseResults.push({
        caseId: benchmarkCase.caseId,
        caseTitle: benchmarkCase.caseTitle,
        expectedL2Code: benchmarkCase.expectedL2Code,
        actualL2Code: classification.l2Code ?? 'UNCLASSIFIED',
        classificationDecisionSource: classification.decisionSource,
        classificationScoreGap: classification.scoreGap,
        taxonomyHit,
        failureModeHit,
        controlHit,
        evidenceHit,
        fullChainHit,
        missCategory: determineMissCategory(taxonomyHit, failureModeHit, controlHit, evidenceHit),
        matchedClassifierSignals: dedupe([
          ...classification.matchedPhrases,
          ...classification.matchedTokens,
        ]),
        expectedFailureModeCodes: benchmarkCase.expectedFailureModeCodes,
        actualFailureModeCodes,
        expectedControlCodes: benchmarkCase.expectedControlCodes,
        actualControlCodes,
        expectedEvidenceCodes,
        actualEvidenceCodes: actualEvidence.codes,
        expectedEvidenceCategories,
        actualEvidenceCategories: actualEvidence.categories,
      })
    }

    const missCategoryCounts = {
      taxonomy: caseResults.filter((result) => result.missCategory === 'taxonomy').length,
      failure_mode: caseResults.filter((result) => result.missCategory === 'failure_mode').length,
      control: caseResults.filter((result) => result.missCategory === 'control').length,
      evidence: caseResults.filter((result) => result.missCategory === 'evidence').length,
    }
    const minFullChainHits = options?.minFullChainHits ?? DEFAULT_MIN_FULL_CHAIN_HITS
    const summary: It04BenchmarkSummary = {
      totalCases: caseResults.length,
      taxonomyHitCount: caseResults.filter((result) => result.taxonomyHit).length,
      failureModeHitCount: caseResults.filter((result) => result.failureModeHit).length,
      controlHitCount: caseResults.filter((result) => result.controlHit).length,
      evidenceHitCount: caseResults.filter((result) => result.evidenceHit).length,
      fullChainHitCount: caseResults.filter((result) => result.fullChainHit).length,
      minFullChainHits,
      meetsGate: caseResults.filter((result) => result.fullChainHit).length >= minFullChainHits,
      missCategoryCounts,
    }

    const report: It04BenchmarkReport = {
      generatedAt: new Date().toISOString(),
      datasetPath,
      taxonomyMappingPath,
      classificationSource: 'hybrid IT04 rulebook + semantic mapping CSV heuristic',
      summary,
      caseResults,
    }

    if (options?.writeReport ?? true) {
      const { jsonPath, markdownPath } = this.writeReport(report)
      report.jsonPath = jsonPath
      report.markdownPath = markdownPath
    }

    return report
  }

  writeReport(report: It04BenchmarkReport): {
    markdownPath: string
    jsonPath: string
  } {
    const reportDir = this.services.reportDir ?? DEFAULT_REPORT_DIR
    const timestamp = report.generatedAt
      .replace(/[:]/g, '-')
      .replace(/\..+$/, '')
      .replace('T', '_')
    const markdownPath = path.resolve(reportDir, `it04-benchmark-report-${timestamp}.md`)
    const jsonPath = path.resolve(reportDir, `it04-benchmark-report-${timestamp}.json`)

    fs.mkdirSync(reportDir, { recursive: true })
    fs.writeFileSync(markdownPath, buildIt04BenchmarkMarkdown(report), 'utf8')
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8')

    return { markdownPath, jsonPath }
  }
}
