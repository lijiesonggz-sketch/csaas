import * as fs from 'fs'
import * as path from 'path'
import * as Papa from 'papaparse'
import { ControlPointService, FullChainResult } from '../../knowledge-graph/services/control-point.service'
import { FailureModeService } from '../../knowledge-graph/services/failure-mode.service'
import { tokenizeText } from './case-theme.utils'
import { CaseClusteringChainService, ChainResult } from './case-clustering-chain.service'

const REPO_ROOT = path.resolve(__dirname, '../../../../../')
const DEFAULT_DATASET_PATH = path.resolve(
  __dirname,
  '../testing/it04-benchmark-cases.fixture.json',
)
const DEFAULT_TAXONOMY_MAPPING_PATH = path.resolve(
  REPO_ROOT,
  'docs/it-taxonomy-to-kg-semantic-mapping-2026-04-07.csv',
)
const DEFAULT_REPORT_DIR = path.resolve(REPO_ROOT, '_bmad-output/test-artifacts')
const DEFAULT_MIN_FULL_CHAIN_HITS = 10

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

export type It04TaxonomySemanticMapping = {
  l1Code: string
  l1Name: string
  l2Code: string
  l2Name: string
  definition: string
  canonicalTheme: string
  aliases: string[]
  keywords: string[]
}

export type It04ClassificationResult = {
  l2Code: string
  l2Name: string
  score: number
  matchedPhrases: string[]
  matchedTokens: string[]
}

export type It04BenchmarkCaseResult = {
  caseId: string
  caseTitle: string
  expectedL2Code: string
  actualL2Code: string
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
  return JSON.parse(fs.readFileSync(datasetPath, 'utf8')) as It04BenchmarkCase[]
}

export function loadIt04TaxonomyMappings(
  taxonomyMappingPath = DEFAULT_TAXONOMY_MAPPING_PATH,
): It04TaxonomySemanticMapping[] {
  const csv = fs.readFileSync(taxonomyMappingPath, 'utf8')
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  })

  return parsed.data
    .filter((row) => row['一级编码'] === 'IT04')
    .map((row) => ({
      l1Code: row['一级编码'],
      l1Name: row['一级类型'],
      l2Code: row['二级编码'],
      l2Name: row['二级子类型'],
      definition: row['定义口径'] ?? '',
      canonicalTheme: row['建议canonicalTheme'] ?? '',
      aliases: splitPipeList(row['建议aliases']),
      keywords: splitPipeList(row['建议keywords']),
    }))
}

export function classifyIt04CaseText(
  caseText: string,
  mappings: It04TaxonomySemanticMapping[],
): It04ClassificationResult {
  const normalizedText = normalizeText(caseText)
  const textTokens = tokenizeText(caseText)

  const scoredMappings = mappings.map((mapping) => {
    const phrases = dedupe([
      mapping.l2Name,
      mapping.canonicalTheme,
      mapping.definition,
      ...mapping.aliases,
      ...mapping.keywords,
    ]).filter((phrase) => phrase.length >= 2)

    const matchedPhrases = phrases.filter((phrase) =>
      normalizedText.includes(normalizeText(phrase)),
    )

    const mappingTokens = new Set(
      dedupe(phrases.flatMap((phrase) => tokenizeText(phrase))).filter((token) => token.length >= 2),
    )
    const matchedTokens = dedupe(textTokens.filter((token) => mappingTokens.has(token)))

    let score = 0
    score += matchedPhrases.reduce(
      (sum, phrase) => sum + (normalizeText(phrase).length >= 6 ? 4 : 2),
      0,
    )
    score += matchedTokens.length * 0.5

    if (normalizedText.includes(normalizeText(mapping.l2Name))) {
      score += 3
    }
    if (mapping.canonicalTheme && normalizedText.includes(normalizeText(mapping.canonicalTheme))) {
      score += 2
    }

    return {
      mapping,
      score,
      matchedPhrases: matchedPhrases.slice(0, 8),
      matchedTokens: matchedTokens.slice(0, 10),
    }
  })

  const best = scoredMappings.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }

    if (right.matchedPhrases.length !== left.matchedPhrases.length) {
      return right.matchedPhrases.length - left.matchedPhrases.length
    }

    return left.mapping.l2Code.localeCompare(right.mapping.l2Code)
  })[0]

  return {
    l2Code: best.mapping.l2Code,
    l2Name: best.mapping.l2Name,
    score: Number(best.score.toFixed(2)),
    matchedPhrases: best.matchedPhrases,
    matchedTokens: best.matchedTokens,
  }
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
    '| Case ID | Expected L2 | Actual L2 | Miss Category | Expected Controls | Actual Controls |',
    '| --- | --- | --- | --- | --- | --- |',
    ...failingCases.map(
      (result) =>
        `| ${result.caseId} | ${result.expectedL2Code} | ${result.actualL2Code} | ${result.missCategory} | ${result.expectedControlCodes.join(', ')} | ${result.actualControlCodes.join(', ')} |`,
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
    const mappings = loadIt04TaxonomyMappings(taxonomyMappingPath)

    const caseResults: It04BenchmarkCaseResult[] = []

    for (const benchmarkCase of benchmarkCases) {
      const classification = classifyIt04CaseText(benchmarkCase.caseText, mappings)

      const failureModeResult = await this.services.failureModeService.findByL2Code(
        classification.l2Code,
        {
          status: 'ACTIVE',
          limit: 50,
        },
      )

      const chainResult = await this.services.caseClusteringChainService.resolveControlPointsByL2Code(
        classification.l2Code,
      )
      const fullChainResult = await this.services.controlPointService.findByL2CodeWithFullChain(
        classification.l2Code,
      )

      const actualFailureModeCodes = dedupe(
        failureModeResult.items.map((failureMode) => failureMode.failureModeCode),
      )
      const actualControlCodes = collectActualControlCodes(chainResult)
      const actualEvidence = collectActualEvidence(
        fullChainResult,
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
        actualL2Code: classification.l2Code,
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
      classificationSource: 'semantic mapping CSV heuristic',
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
