import * as fs from 'fs'
import * as path from 'path'
import { ControlPointService, FullChainResult } from '../../knowledge-graph/services/control-point.service'
import { FailureModeService } from '../../knowledge-graph/services/failure-mode.service'
import { CaseClusteringChainService, ChainResult } from './case-clustering-chain.service'
import type {
  TaxonomyClassificationRequest,
  TaxonomyClassificationResult,
  TaxonomyDecisionSource,
  TaxonomyFailureSemantic,
  TaxonomyPathDecision,
} from './taxonomy-classification/contracts/classification-result.contract'
import { listRuntimeReadyTaxonomyDomainCodes } from './taxonomy-classification/profiles/domain-registry'

export type TaxonomyBenchmarkTier =
  | 'tier-0-smoke'
  | 'tier-1-cutover'
  | 'tier-2-holdout'

export type TaxonomyBenchmarkMode =
  | 'new-path'
  | 'legacy-path'
  | 'dual-path-compare'

export const TAXONOMY_BENCHMARK_TIERS: TaxonomyBenchmarkTier[] = [
  'tier-0-smoke',
  'tier-1-cutover',
  'tier-2-holdout',
]

export const TAXONOMY_BENCHMARK_MODES: TaxonomyBenchmarkMode[] = [
  'new-path',
  'legacy-path',
  'dual-path-compare',
]

type TaxonomyClassifierServiceLike = {
  classifyCaseText(
    request: TaxonomyClassificationRequest,
  ): TaxonomyClassificationResult
}

type FailureModeServiceLike = Pick<FailureModeService, 'findByL2Code'>
type ControlPointServiceLike = Pick<ControlPointService, 'findByL2CodeWithFullChain'>
type CaseClusteringChainServiceLike = Pick<
  CaseClusteringChainService,
  'resolveControlPointsByL2Code'
>

export type TaxonomyBenchmarkRiskTag =
  | 'SMOKE'
  | 'HIGH_RISK'
  | 'HISTORICAL_FALLBACK'
  | 'HOLDOUT'
  | 'AMBIGUOUS_BOUNDARY'
  | 'MISSING_FIELDS'

export type TaxonomyBenchmarkCase = {
  caseId: string
  caseTitle: string
  caseText: string
  l1Code: string
  tier?: TaxonomyBenchmarkTier
  riskTags?: string[]
  expectedL2Code: string
  expectedFailureModeCodes: string[]
  expectedControlCodes: string[]
  expectedEvidenceCodes?: string[]
  expectedEvidenceCategories?: string[]
  notes?: string
  sourceFile?: string
}

export type TaxonomyBenchmarkFixtureSet = {
  tier: TaxonomyBenchmarkTier
  l1Code: string
  fixtureFile: string
  caseCount: number
  riskTags: string[]
}

export type TaxonomyBenchmarkCompareDisagreement = {
  caseId: string
  l1Code: string
  tier: TaxonomyBenchmarkTier
  riskTags: string[]
  newPath: {
    l2Code: string
    pathDecision: TaxonomyPathDecision
    failureSemantic: TaxonomyFailureSemantic | null
  }
  legacyPath: {
    l2Code: string
    pathDecision: TaxonomyPathDecision
    failureSemantic: TaxonomyFailureSemantic | null
  }
  missCategory: TaxonomyBenchmarkCaseResult['missCategory']
  compareOutcome: 'same' | 'different' | 'legacy-unavailable'
  reason: string
}

export type TaxonomyBenchmarkCaseResult = {
  caseId: string
  caseTitle: string
  l1Code: string
  tier: TaxonomyBenchmarkTier
  riskTags: string[]
  expectedL2Code: string
  actualL2Code: string
  classificationDecisionSource: TaxonomyDecisionSource
  classificationScoreGap: number
  classifierVersion?: string
  pathDecision: TaxonomyPathDecision
  failureSemantic: TaxonomyFailureSemantic | null
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
  reasonSummary: string
  highRiskFalseNegative: boolean
  fallbackTriggered: boolean
  sourceFile?: string
}

export type TaxonomyBenchmarkGateThresholds = {
  taxonomyPrecision: number
  taxonomyRecall: number
  fullChainHitRate: number
  highRiskFalseNegativeRate: number
  fallbackTriggerRate: number
}

export type TaxonomyBenchmarkMetrics = {
  totalCases: number
  taxonomyHitCount: number
  failureModeHitCount: number
  controlHitCount: number
  evidenceHitCount: number
  fullChainHitCount: number
  taxonomyPrecision: number
  taxonomyRecall: number
  taxonomyF1: number
  failureModeHitRate: number
  controlHitRate: number
  evidenceHitRate: number
  fullChainHitRate: number
  abstainCount: number
  abstainRate: number
  fallbackTriggerCount: number
  fallbackTriggerRate: number
  highRiskCaseCount: number
  highRiskFalseNegativeCount: number
  highRiskFalseNegativeRate: number
  missCategoryCounts: Record<
    'taxonomy' | 'failure_mode' | 'control' | 'evidence',
    number
  >
  confusionMatrix: Record<string, Record<string, number>>
}

export type TaxonomyBenchmarkGateDecision = {
  gateStatus: 'PASS' | 'FAIL'
  reasons: string[]
  thresholds: TaxonomyBenchmarkGateThresholds
  missingSlices: string[]
}

export type TaxonomyBenchmarkSummary = TaxonomyBenchmarkMetrics &
  TaxonomyBenchmarkGateDecision

export type TaxonomyBenchmarkCompareSummary = {
  totalCompared: number
  disagreementCount: number
  disagreements: TaxonomyBenchmarkCompareDisagreement[]
}

export type TaxonomyBenchmarkMachineSummary = {
  generatedAt: string
  reportId: string
  mode: TaxonomyBenchmarkMode
  classifierVersion?: string | null
  domains: string[]
  tiers: TaxonomyBenchmarkTier[]
  gateStatus: 'PASS' | 'FAIL'
  metrics: TaxonomyBenchmarkMetrics
  thresholds: TaxonomyBenchmarkGateThresholds
  missingSlices: string[]
  groups: Record<
    string,
    Record<
      string,
      Record<
        string,
        {
          sampleCount: number
          gateStatus: 'PASS' | 'FAIL'
          metrics: TaxonomyBenchmarkMetrics
          thresholds: TaxonomyBenchmarkGateThresholds
          missingSlices: string[]
        }
      >
    >
  >
  compareSummary?: {
    totalCompared: number
    disagreementCount: number
  }
}

export type TaxonomyBenchmarkReport = {
  reportId: string
  title: string
  generatedAt: string
  mode: TaxonomyBenchmarkMode
  fixtureBaseDir: string
  datasetPaths: string[]
  domains: string[]
  tiers: TaxonomyBenchmarkTier[]
  summary: TaxonomyBenchmarkSummary
  caseResults: TaxonomyBenchmarkCaseResult[]
  compareSummary?: TaxonomyBenchmarkCompareSummary
  compatibility: {
    legacyReportId: string | null
    markdownTitle: string
  }
  markdownPath?: string
  jsonPath?: string
  machineSummaryPath?: string
}

type TaxonomyBenchmarkPathEvaluation = {
  classification: TaxonomyClassificationResult
}

const DEFAULT_EVIDENCE_THRESHOLDS: TaxonomyBenchmarkGateThresholds = {
  taxonomyPrecision: 0,
  taxonomyRecall: 0,
  fullChainHitRate: 0,
  highRiskFalseNegativeRate: 1,
  fallbackTriggerRate: 1,
}

const DEFAULT_REPORT_ID = 'taxonomy-benchmark'
const DEFAULT_REPORT_TITLE = 'Taxonomy Benchmark Report'

const REQUIRED_RISK_SLICES = [
  'tier-1-cutover/high-risk',
  'tier-1-cutover/historical-fallback',
  'tier-2-holdout/ambiguous-boundary',
  'tier-2-holdout/historical-fallback',
] as const

function resolveExistingPath(candidates: string[]): string {
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  return found ?? candidates[0]
}

export function resolveWorkspaceArtifactPath(relativePath: string): {
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

const DEFAULT_FIXTURE_BASE_DIR_RESOLUTION = resolveWorkspaceArtifactPath(
  'backend/src/modules/case-import-orchestrator/testing/benchmarks',
)
const DEFAULT_REPORT_DIR_RESOLUTION = resolveWorkspaceArtifactPath(
  '_bmad-output/test-artifacts',
)

export const DEFAULT_TAXONOMY_BENCHMARK_FIXTURE_BASE_DIR =
  DEFAULT_FIXTURE_BASE_DIR_RESOLUTION.resolvedPath
export const DEFAULT_TAXONOMY_BENCHMARK_REPORT_DIR =
  DEFAULT_REPORT_DIR_RESOLUTION.resolvedPath

function normalizeText(value: string): string {
  return value.replace(/\s+/g, '').trim()
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)))
}

function toRate(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0
  }

  return Number((numerator / denominator).toFixed(4))
}

function calculateF1(precision: number, recall: number): number {
  if (precision === 0 || recall === 0) {
    return 0
  }

  return Number(((2 * precision * recall) / (precision + recall)).toFixed(4))
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
): TaxonomyBenchmarkCaseResult['missCategory'] {
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

function buildReasonSummary(args: {
  missCategory: TaxonomyBenchmarkCaseResult['missCategory']
  classification: TaxonomyClassificationResult
  benchmarkCase: TaxonomyBenchmarkCase
  actualFailureModeCodes: string[]
  actualControlCodes: string[]
  actualEvidenceCodes: string[]
  actualEvidenceCategories: string[]
}): string {
  const {
    missCategory,
    classification,
    benchmarkCase,
    actualFailureModeCodes,
    actualControlCodes,
    actualEvidenceCodes,
    actualEvidenceCategories,
  } = args

  if (missCategory === 'none') {
    return 'full-chain benchmark expectations matched'
  }

  if (classification.failureSemantics) {
    return `classification ended with ${classification.failureSemantics}; expected ${benchmarkCase.expectedL2Code}, actual ${classification.l2Code ?? 'UNCLASSIFIED'}`
  }

  if (missCategory === 'taxonomy') {
    return `expected ${benchmarkCase.expectedL2Code} but resolved ${classification.l2Code ?? 'UNCLASSIFIED'}`
  }

  if (missCategory === 'failure_mode') {
    return `expected failure modes [${benchmarkCase.expectedFailureModeCodes.join(', ')}], actual [${actualFailureModeCodes.join(', ') || 'none'}]`
  }

  if (missCategory === 'control') {
    return `expected controls [${benchmarkCase.expectedControlCodes.join(', ')}], actual [${actualControlCodes.join(', ') || 'none'}]`
  }

  return `expected evidence codes [${(benchmarkCase.expectedEvidenceCodes ?? []).join(', ')}], actual codes [${actualEvidenceCodes.join(', ') || 'none'}], expected categories [${(benchmarkCase.expectedEvidenceCategories ?? []).join(', ')}], actual categories [${actualEvidenceCategories.join(', ') || 'none'}]`
}

function buildMetricsFromCaseResults(
  caseResults: TaxonomyBenchmarkCaseResult[],
): TaxonomyBenchmarkMetrics {
  const totalCases = caseResults.length
  const taxonomyHitCount = caseResults.filter((result) => result.taxonomyHit).length
  const failureModeHitCount = caseResults.filter((result) => result.failureModeHit).length
  const controlHitCount = caseResults.filter((result) => result.controlHit).length
  const evidenceHitCount = caseResults.filter((result) => result.evidenceHit).length
  const fullChainHitCount = caseResults.filter((result) => result.fullChainHit).length
  const abstainCount = caseResults.filter(
    (result) =>
      result.pathDecision === 'ABSTAIN' ||
      result.pathDecision === 'UNCLASSIFIED',
  ).length
  const fallbackTriggerCount = caseResults.filter(
    (result) => result.fallbackTriggered,
  ).length
  const highRiskCases = caseResults.filter((result) =>
    result.riskTags.includes('HIGH_RISK'),
  )
  const highRiskFalseNegativeCount = highRiskCases.filter(
    (result) => result.highRiskFalseNegative,
  ).length

  const predictedCount = caseResults.filter(
    (result) => result.actualL2Code !== 'UNCLASSIFIED',
  ).length

  const confusionMatrix = caseResults.reduce<Record<string, Record<string, number>>>(
    (matrix, result) => {
      const expectedKey = result.expectedL2Code
      const actualKey = result.actualL2Code

      if (!matrix[expectedKey]) {
        matrix[expectedKey] = {}
      }
      matrix[expectedKey][actualKey] = (matrix[expectedKey][actualKey] ?? 0) + 1
      return matrix
    },
    {},
  )

  return {
    totalCases,
    taxonomyHitCount,
    failureModeHitCount,
    controlHitCount,
    evidenceHitCount,
    fullChainHitCount,
    taxonomyPrecision: toRate(taxonomyHitCount, predictedCount || totalCases),
    taxonomyRecall: toRate(taxonomyHitCount, totalCases),
    taxonomyF1: calculateF1(
      toRate(taxonomyHitCount, predictedCount || totalCases),
      toRate(taxonomyHitCount, totalCases),
    ),
    failureModeHitRate: toRate(failureModeHitCount, totalCases),
    controlHitRate: toRate(controlHitCount, totalCases),
    evidenceHitRate: toRate(evidenceHitCount, totalCases),
    fullChainHitRate: toRate(fullChainHitCount, totalCases),
    abstainCount,
    abstainRate: toRate(abstainCount, totalCases),
    fallbackTriggerCount,
    fallbackTriggerRate: toRate(fallbackTriggerCount, totalCases),
    highRiskCaseCount: highRiskCases.length,
    highRiskFalseNegativeCount,
    highRiskFalseNegativeRate: toRate(
      highRiskFalseNegativeCount,
      highRiskCases.length,
    ),
    missCategoryCounts: {
      taxonomy: caseResults.filter((result) => result.missCategory === 'taxonomy').length,
      failure_mode: caseResults.filter((result) => result.missCategory === 'failure_mode').length,
      control: caseResults.filter((result) => result.missCategory === 'control').length,
      evidence: caseResults.filter((result) => result.missCategory === 'evidence').length,
    },
    confusionMatrix,
  }
}

function buildMachineSummaryGroups(
  caseResults: TaxonomyBenchmarkCaseResult[],
  thresholds: TaxonomyBenchmarkGateThresholds,
  domains: string[],
  tiers: TaxonomyBenchmarkTier[],
  mode: TaxonomyBenchmarkMode,
): TaxonomyBenchmarkMachineSummary['groups'] {
  const groups: TaxonomyBenchmarkMachineSummary['groups'] = {}

  for (const domain of domains) {
    groups[domain] = {}

    for (const tier of tiers) {
      const scopedCases = caseResults.filter(
        (candidate) => candidate.l1Code === domain && candidate.tier === tier,
      )

      const metrics = buildMetricsFromCaseResults(scopedCases)
      const groupMissingSlices =
        scopedCases.length === 0 ? ['empty-slice'] : []
      const gateDecision = evaluateTaxonomyBenchmarkGate({
        metrics,
        thresholds,
        missingSlices: groupMissingSlices,
      })

      groups[domain][tier] = {
        [mode]: {
          sampleCount: scopedCases.length,
          gateStatus: gateDecision.gateStatus,
          metrics,
          thresholds,
          missingSlices: groupMissingSlices,
        },
      }
    }
  }

  return groups
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
        relevantControls.size === 0
          ? true
          : relevantControls.has(controlPoint.controlCode),
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

function inferTierFromPath(filePath: string): TaxonomyBenchmarkTier {
  const normalizedPath = filePath.replace(/\\/g, '/')
  if (normalizedPath.includes('/tier-1-cutover/')) {
    return 'tier-1-cutover'
  }
  if (normalizedPath.includes('/tier-2-holdout/')) {
    return 'tier-2-holdout'
  }
  return 'tier-0-smoke'
}

function normalizeRiskTags(tags?: string[]): string[] {
  return dedupe(
    (tags ?? []).map((tag) =>
      normalizeText(tag).toUpperCase().replace(/-/g, '_'),
    ),
  )
}

function readRequiredJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function listFixtureFiles(baseDir: string): string[] {
  if (!fs.existsSync(baseDir)) {
    return []
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFixtureFiles(fullPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.fixture.json')) {
      files.push(fullPath)
    }
  }

  return files.sort()
}

export function loadTaxonomyBenchmarkCasesFromFile(
  filePath: string,
): TaxonomyBenchmarkCase[] {
  const inferredTier = inferTierFromPath(filePath)
  const rawCases = readRequiredJsonFile<TaxonomyBenchmarkCase[]>(filePath)

  return rawCases.map((benchmarkCase) => ({
    ...benchmarkCase,
    tier: benchmarkCase.tier ?? inferredTier,
    riskTags: normalizeRiskTags(benchmarkCase.riskTags),
    expectedFailureModeCodes: benchmarkCase.expectedFailureModeCodes ?? [],
    expectedControlCodes: benchmarkCase.expectedControlCodes ?? [],
    expectedEvidenceCodes: benchmarkCase.expectedEvidenceCodes ?? [],
    expectedEvidenceCategories: benchmarkCase.expectedEvidenceCategories ?? [],
    sourceFile: filePath,
  }))
}

function collectMissingSlices(
  benchmarkCases: TaxonomyBenchmarkCase[],
  tiers: TaxonomyBenchmarkTier[],
): string[] {
  const presentSlices = new Set<string>()

  for (const benchmarkCase of benchmarkCases) {
    const tier = benchmarkCase.tier ?? 'tier-0-smoke'
    const riskTags = normalizeRiskTags(benchmarkCase.riskTags)

    if (tier === 'tier-1-cutover' && riskTags.includes('HIGH_RISK')) {
      presentSlices.add('tier-1-cutover/high-risk')
    }
    if (tier === 'tier-1-cutover' && riskTags.includes('HISTORICAL_FALLBACK')) {
      presentSlices.add('tier-1-cutover/historical-fallback')
    }
    if (tier === 'tier-2-holdout' && riskTags.includes('AMBIGUOUS_BOUNDARY')) {
      presentSlices.add('tier-2-holdout/ambiguous-boundary')
    }
    if (tier === 'tier-2-holdout' && riskTags.includes('HISTORICAL_FALLBACK')) {
      presentSlices.add('tier-2-holdout/historical-fallback')
    }
  }

  return REQUIRED_RISK_SLICES.filter((slice) => {
    if (slice.startsWith('tier-1') && !tiers.includes('tier-1-cutover')) {
      return false
    }
    if (slice.startsWith('tier-2') && !tiers.includes('tier-2-holdout')) {
      return false
    }
    return !presentSlices.has(slice)
  })
}

export function evaluateTaxonomyBenchmarkGate(input: {
  metrics: Partial<TaxonomyBenchmarkMetrics>
  thresholds?: Partial<TaxonomyBenchmarkGateThresholds>
  missingSlices?: string[]
}): TaxonomyBenchmarkGateDecision {
  const thresholds = {
    ...DEFAULT_EVIDENCE_THRESHOLDS,
    ...(input.thresholds ?? {}),
  }
  const reasons: string[] = []
  const missingSlices = [...(input.missingSlices ?? [])]

  if (missingSlices.length > 0) {
    reasons.push(
      ...missingSlices.map((slice) => `required benchmark slice missing: ${slice}`),
    )
  }

  if ((input.metrics.taxonomyPrecision ?? 0) < thresholds.taxonomyPrecision) {
    reasons.push(
      `taxonomy precision below threshold: ${input.metrics.taxonomyPrecision ?? 0} < ${thresholds.taxonomyPrecision}`,
    )
  }

  if ((input.metrics.taxonomyRecall ?? 0) < thresholds.taxonomyRecall) {
    reasons.push(
      `taxonomy recall below threshold: ${input.metrics.taxonomyRecall ?? 0} < ${thresholds.taxonomyRecall}`,
    )
  }

  if ((input.metrics.fullChainHitRate ?? 0) < thresholds.fullChainHitRate) {
    reasons.push(
      `full-chain hit rate below threshold: ${input.metrics.fullChainHitRate ?? 0} < ${thresholds.fullChainHitRate}`,
    )
  }

  if (
    (input.metrics.highRiskFalseNegativeRate ?? 0) >
    thresholds.highRiskFalseNegativeRate
  ) {
    reasons.push(
      `high-risk false negative rate above threshold: ${
        input.metrics.highRiskFalseNegativeRate ?? 0
      } > ${thresholds.highRiskFalseNegativeRate}`,
    )
  }

  if (
    (input.metrics.fallbackTriggerRate ?? 0) >
    thresholds.fallbackTriggerRate
  ) {
    reasons.push(
      `fallback trigger rate above threshold: ${
        input.metrics.fallbackTriggerRate ?? 0
      } > ${thresholds.fallbackTriggerRate}`,
    )
  }

  return {
    gateStatus: reasons.length === 0 ? 'PASS' : 'FAIL',
    reasons,
    thresholds,
    missingSlices,
  }
}

export function buildTaxonomyBenchmarkMachineSummary(input: {
  generatedAt: string
  reportId?: string
  mode: TaxonomyBenchmarkMode
  classifierVersion?: string | null
  domains: string[]
  tiers: TaxonomyBenchmarkTier[]
  summary: Partial<TaxonomyBenchmarkMetrics>
  caseResults?: TaxonomyBenchmarkCaseResult[]
  gateStatus?: 'PASS' | 'FAIL'
  thresholds?: Partial<TaxonomyBenchmarkGateThresholds>
  missingSlices?: string[]
  compareSummary?: TaxonomyBenchmarkCompareSummary
}): TaxonomyBenchmarkMachineSummary {
  const thresholds = {
    ...DEFAULT_EVIDENCE_THRESHOLDS,
    ...(input.thresholds ?? {}),
  }

  const metrics: TaxonomyBenchmarkMetrics = {
    totalCases: input.summary.totalCases ?? 0,
    taxonomyHitCount: input.summary.taxonomyHitCount ?? 0,
    failureModeHitCount: input.summary.failureModeHitCount ?? 0,
    controlHitCount: input.summary.controlHitCount ?? 0,
    evidenceHitCount: input.summary.evidenceHitCount ?? 0,
    fullChainHitCount: input.summary.fullChainHitCount ?? 0,
    taxonomyPrecision: input.summary.taxonomyPrecision ?? 0,
    taxonomyRecall: input.summary.taxonomyRecall ?? 0,
    taxonomyF1: input.summary.taxonomyF1 ?? 0,
    failureModeHitRate: input.summary.failureModeHitRate ?? 0,
    controlHitRate: input.summary.controlHitRate ?? 0,
    evidenceHitRate: input.summary.evidenceHitRate ?? 0,
    fullChainHitRate: input.summary.fullChainHitRate ?? 0,
    abstainCount: input.summary.abstainCount ?? 0,
    abstainRate: input.summary.abstainRate ?? 0,
    fallbackTriggerCount: input.summary.fallbackTriggerCount ?? 0,
    fallbackTriggerRate: input.summary.fallbackTriggerRate ?? 0,
    highRiskCaseCount: input.summary.highRiskCaseCount ?? 0,
    highRiskFalseNegativeCount: input.summary.highRiskFalseNegativeCount ?? 0,
    highRiskFalseNegativeRate: input.summary.highRiskFalseNegativeRate ?? 0,
    missCategoryCounts: input.summary.missCategoryCounts ?? {
      taxonomy: 0,
      failure_mode: 0,
      control: 0,
      evidence: 0,
    },
    confusionMatrix: input.summary.confusionMatrix ?? {},
  }

  const classifierVersion =
    input.classifierVersion ??
    (() => {
      const versions = [
        ...new Set(
          (input.caseResults ?? [])
            .map((result) => result.classifierVersion ?? null)
            .filter((value): value is string => Boolean(value)),
        ),
      ]

      return versions.length === 1 ? versions[0] : null
    })()

  return {
    generatedAt: input.generatedAt,
    reportId: input.reportId ?? DEFAULT_REPORT_ID,
    mode: input.mode,
    classifierVersion,
    domains: [...input.domains],
    tiers: [...input.tiers],
    gateStatus: input.gateStatus ?? 'FAIL',
    metrics,
    thresholds,
    missingSlices: [...(input.missingSlices ?? [])],
    groups: input.caseResults
      ? buildMachineSummaryGroups(
          input.caseResults,
          thresholds,
          input.domains,
          input.tiers,
          input.mode,
        )
      : {},
    compareSummary: input.compareSummary
      ? {
          totalCompared: input.compareSummary.totalCompared,
          disagreementCount: input.compareSummary.disagreementCount,
        }
      : undefined,
  }
}

export function buildTaxonomyBenchmarkMarkdown(
  report: TaxonomyBenchmarkReport,
): string {
  const failingCases = report.caseResults.filter((result) => !result.fullChainHit)
  const lines = [
    `# ${report.compatibility.markdownTitle}`,
    '',
    `- Generated: ${report.generatedAt}`,
    `- Mode: ${report.mode}`,
    `- Report ID: ${report.reportId}`,
    `- Fixture base dir: ${report.fixtureBaseDir}`,
    `- Datasets: ${report.datasetPaths.join(', ')}`,
    `- Domains: ${report.domains.join(', ')}`,
    `- Tiers: ${report.tiers.join(', ')}`,
    '',
    '## Summary',
    '',
    `- Total cases: ${report.summary.totalCases}`,
    `- Taxonomy hits: ${report.summary.taxonomyHitCount}`,
    `- Failure mode hits: ${report.summary.failureModeHitCount}`,
    `- Control hits: ${report.summary.controlHitCount}`,
    `- Evidence hits: ${report.summary.evidenceHitCount}`,
    `- Full-chain hits: ${report.summary.fullChainHitCount}`,
    `- Taxonomy precision: ${report.summary.taxonomyPrecision}`,
    `- Taxonomy recall: ${report.summary.taxonomyRecall}`,
    `- Taxonomy F1: ${report.summary.taxonomyF1}`,
    `- Abstain rate: ${report.summary.abstainRate}`,
    `- Fallback trigger rate: ${report.summary.fallbackTriggerRate}`,
    `- High-risk false negative rate: ${report.summary.highRiskFalseNegativeRate}`,
    `- Gate: ${report.summary.gateStatus}`,
    '',
    '## Miss Categories',
    '',
    `- Taxonomy: ${report.summary.missCategoryCounts.taxonomy}`,
    `- Failure mode: ${report.summary.missCategoryCounts.failure_mode}`,
    `- Control: ${report.summary.missCategoryCounts.control}`,
    `- Evidence: ${report.summary.missCategoryCounts.evidence}`,
    '',
    '## Confusion Matrix',
    '',
    '```json',
    JSON.stringify(report.summary.confusionMatrix, null, 2),
    '```',
    '',
    '## Gaps',
    '',
    '| Case ID | Domain | Tier | Expected L2 | Actual L2 | Path | Failure | Risk Tags | Miss Category | Reason |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...failingCases.map(
      (result) =>
        `| ${result.caseId} | ${result.l1Code} | ${result.tier} | ${result.expectedL2Code} | ${result.actualL2Code} | ${result.pathDecision} | ${result.failureSemantic ?? 'none'} | ${result.riskTags.join(', ')} | ${result.missCategory} | ${result.reasonSummary} |`,
    ),
  ]

  if (report.compareSummary) {
    lines.push(
      '',
      '## Compare Summary',
      '',
      `- Compared cases: ${report.compareSummary.totalCompared}`,
      `- Disagreements: ${report.compareSummary.disagreementCount}`,
      '',
      '| Case ID | Tier | New Path | Legacy Path | Miss Category | Reason |',
      '| --- | --- | --- | --- | --- | --- |',
      ...report.compareSummary.disagreements.map(
        (disagreement) =>
          `| ${disagreement.caseId} | ${disagreement.tier} | ${disagreement.newPath.l2Code}/${disagreement.newPath.pathDecision} | ${disagreement.legacyPath.l2Code}/${disagreement.legacyPath.pathDecision} | ${disagreement.missCategory} | ${disagreement.reason} |`,
      ),
    )
  }

  return lines.join('\n')
}

function buildUnavailableResult(
  l1Code: string,
  classifierVersion: string,
): TaxonomyClassificationResult {
  return {
    l1Code,
    l2Code: null,
    l2Name: null,
    score: 0,
    confidenceScore: 0,
    scoreGap: 0,
    decisionSource: 'none',
    matchedSignals: [],
    matchedPhrases: [],
    matchedTokens: [],
    classifierVersion,
    mappingVersion: 'unconfigured',
    rulebookVersion: 'unconfigured',
    classifiedAt: new Date().toISOString(),
    pathDecision: 'UNCLASSIFIED',
    failureSemantics: 'UNSUPPORTED_DOMAIN',
  }
}

type TaxonomyBenchmarkRunnerServices = {
  failureModeService: FailureModeServiceLike
  controlPointService: ControlPointServiceLike
  caseClusteringChainService: CaseClusteringChainServiceLike
  taxonomyClassifierService?: TaxonomyClassifierServiceLike
  evaluateNewPathCase?: (
    benchmarkCase: TaxonomyBenchmarkCase,
  ) => TaxonomyClassificationResult
  evaluateLegacyPathCase?: (
    benchmarkCase: TaxonomyBenchmarkCase,
  ) => TaxonomyClassificationResult | null
  fixtureBaseDir?: string
  reportDir?: string
  reportId?: string
  reportTitle?: string
  reportFilePrefix?: string
  compatibility?: {
    legacyReportId?: string | null
    markdownTitle?: string
  }
}

export class TaxonomyBenchmarkRunner {
  constructor(private readonly services: TaxonomyBenchmarkRunnerServices) {}

  discoverFixtures(options?: {
    tiers?: TaxonomyBenchmarkTier[]
    domainCodes?: string[]
  }): TaxonomyBenchmarkFixtureSet[] {
    const tiers = options?.tiers ?? TAXONOMY_BENCHMARK_TIERS
    const domainCodes = new Set(options?.domainCodes ?? [])
    const fixtureBaseDir =
      this.services.fixtureBaseDir ?? DEFAULT_TAXONOMY_BENCHMARK_FIXTURE_BASE_DIR
    const files = listFixtureFiles(fixtureBaseDir)
    const discovered: TaxonomyBenchmarkFixtureSet[] = []

    for (const file of files) {
      const benchmarkCases = loadTaxonomyBenchmarkCasesFromFile(file)
      const filteredCases = benchmarkCases.filter((benchmarkCase) => {
        const tier = benchmarkCase.tier ?? 'tier-0-smoke'
        if (!tiers.includes(tier)) {
          return false
        }
        if (domainCodes.size === 0) {
          return true
        }
        return domainCodes.has(benchmarkCase.l1Code)
      })

      if (filteredCases.length === 0) {
        continue
      }

      discovered.push({
        tier: filteredCases[0].tier ?? 'tier-0-smoke',
        l1Code: filteredCases[0].l1Code,
        fixtureFile: file,
        caseCount: filteredCases.length,
        riskTags: dedupe(filteredCases.flatMap((benchmarkCase) => benchmarkCase.riskTags ?? [])),
      })
    }

    return discovered
  }

  async runBenchmark(options?: {
    mode?: TaxonomyBenchmarkMode
    tiers?: TaxonomyBenchmarkTier[]
    domainCodes?: string[]
    benchmarkCases?: TaxonomyBenchmarkCase[]
    writeReport?: boolean
    thresholds?: Partial<TaxonomyBenchmarkGateThresholds>
    reportId?: string
    reportTitle?: string
    reportFilePrefix?: string
  }): Promise<TaxonomyBenchmarkReport> {
    const mode = options?.mode ?? 'new-path'
    const tiers = options?.tiers ?? TAXONOMY_BENCHMARK_TIERS
    const domainsFromArgs =
      options?.domainCodes ?? listRuntimeReadyTaxonomyDomainCodes()
    const benchmarkCases =
      options?.benchmarkCases ?? this.loadBenchmarkCases({ tiers, domainCodes: domainsFromArgs })

    if (benchmarkCases.length === 0) {
      throw new Error(
        `No taxonomy benchmark fixtures matched tiers=${tiers.join(',')} domains=${domainsFromArgs.join(',')}`,
      )
    }

    const datasetPaths = dedupe(
      benchmarkCases
        .map((benchmarkCase) => benchmarkCase.sourceFile ?? '')
        .filter((value) => value.length > 0),
    )
    const domains =
      domainsFromArgs.length > 0
        ? [...domainsFromArgs]
        : dedupe(benchmarkCases.map((benchmarkCase) => benchmarkCase.l1Code))
    const missingDomains =
      options?.benchmarkCases || domainsFromArgs.length === 0
        ? []
        : domainsFromArgs.filter(
            (domainCode) =>
              !benchmarkCases.some(
                (benchmarkCase) => benchmarkCase.l1Code === domainCode,
              ),
          )

    if (missingDomains.length > 0) {
      throw new Error(`No fixtures for domains: ${missingDomains.join(',')}`)
    }

    const caseResults: TaxonomyBenchmarkCaseResult[] = []
    const disagreements: TaxonomyBenchmarkCompareDisagreement[] = []
    let comparedCaseCount = 0

    for (const benchmarkCase of benchmarkCases) {
      const newPath = this.evaluateNewPathCase(benchmarkCase)
      const legacyPath =
        mode === 'legacy-path' || mode === 'dual-path-compare'
          ? this.evaluateLegacyPathCase(benchmarkCase)
          : null
      if (mode === 'legacy-path' && legacyPath == null) {
        throw new Error(`Legacy path unavailable for benchmark case ${benchmarkCase.caseId} (${benchmarkCase.l1Code})`)
      }
      const selectedPath =
        mode === 'legacy-path' ? legacyPath! : newPath

      const caseResult = await this.buildCaseResult(
        benchmarkCase,
        selectedPath.classification,
      )
      caseResults.push(caseResult)

      if (mode === 'dual-path-compare') {
        comparedCaseCount += 1
        const effectiveLegacyPath =
          legacyPath ?? {
            classification: buildUnavailableResult(
              benchmarkCase.l1Code,
              'legacy-path-unavailable',
            ),
          }
        const disagreement = this.buildCompareDisagreement(
          benchmarkCase,
          newPath.classification,
          effectiveLegacyPath.classification,
          caseResult.missCategory,
        )
        if (disagreement.compareOutcome !== 'same') {
          disagreements.push(disagreement)
        }
      }
    }

    const metrics = buildMetricsFromCaseResults(caseResults)
    const missingSlices =
      options?.domainCodes &&
      options.domainCodes.length > 0 &&
      options.domainCodes.length < listRuntimeReadyTaxonomyDomainCodes().length
        ? []
        : collectMissingSlices(benchmarkCases, tiers)
    const gateDecision = evaluateTaxonomyBenchmarkGate({
      metrics,
      thresholds: options?.thresholds,
      missingSlices,
    })

    const summary: TaxonomyBenchmarkSummary = {
      ...metrics,
      ...gateDecision,
    }

    const compareSummary =
      mode === 'dual-path-compare'
        ? {
            totalCompared: comparedCaseCount,
            disagreementCount: disagreements.length,
            disagreements,
          }
        : undefined

    const report: TaxonomyBenchmarkReport = {
      reportId: options?.reportId ?? this.services.reportId ?? DEFAULT_REPORT_ID,
      title:
        options?.reportTitle ?? this.services.reportTitle ?? DEFAULT_REPORT_TITLE,
      generatedAt: new Date().toISOString(),
      mode,
      fixtureBaseDir:
        this.services.fixtureBaseDir ?? DEFAULT_TAXONOMY_BENCHMARK_FIXTURE_BASE_DIR,
      datasetPaths,
      domains,
      tiers,
      summary,
      caseResults,
      compareSummary,
      compatibility: {
        legacyReportId:
          options?.reportId ??
          this.services.compatibility?.legacyReportId ??
          null,
        markdownTitle:
          this.services.compatibility?.markdownTitle ??
          options?.reportTitle ??
          this.services.reportTitle ??
          DEFAULT_REPORT_TITLE,
      },
    }

    if (options?.writeReport ?? true) {
      const { markdownPath, jsonPath, machineSummaryPath } = this.writeReport(
        report,
        options?.reportFilePrefix ?? this.services.reportFilePrefix,
      )
      report.markdownPath = markdownPath
      report.jsonPath = jsonPath
      report.machineSummaryPath = machineSummaryPath
    }

    return report
  }

  writeReport(
    report: TaxonomyBenchmarkReport,
    reportFilePrefix?: string,
  ): {
    markdownPath: string
    jsonPath: string
    machineSummaryPath: string
  } {
    const reportDir =
      this.services.reportDir ?? DEFAULT_TAXONOMY_BENCHMARK_REPORT_DIR
    const timestamp = report.generatedAt
      .replace(/[:]/g, '-')
      .replace(/\..+$/, '')
      .replace('T', '_')
    const safePrefix =
      reportFilePrefix ??
      `${report.reportId}-report`.replace(/[^a-zA-Z0-9-]/g, '-')

    const markdownPath = path.resolve(reportDir, `${safePrefix}-${timestamp}.md`)
    const jsonPath = path.resolve(reportDir, `${safePrefix}-${timestamp}.json`)
    const machineSummaryPath = path.resolve(
      reportDir,
      `${safePrefix}-summary-${timestamp}.json`,
    )

    const machineSummary = buildTaxonomyBenchmarkMachineSummary({
      generatedAt: report.generatedAt,
      reportId: report.reportId,
      mode: report.mode,
      domains: report.domains,
      tiers: report.tiers,
      summary: report.summary,
      caseResults: report.caseResults,
      gateStatus: report.summary.gateStatus,
      thresholds: report.summary.thresholds,
      missingSlices: report.summary.missingSlices,
      compareSummary: report.compareSummary,
    })

    fs.mkdirSync(reportDir, { recursive: true })
    fs.writeFileSync(markdownPath, buildTaxonomyBenchmarkMarkdown(report), 'utf8')
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8')
    fs.writeFileSync(machineSummaryPath, JSON.stringify(machineSummary, null, 2), 'utf8')

    return {
      markdownPath,
      jsonPath,
      machineSummaryPath,
    }
  }

  private loadBenchmarkCases(options?: {
    tiers?: TaxonomyBenchmarkTier[]
    domainCodes?: string[]
  }): TaxonomyBenchmarkCase[] {
    const tiers = options?.tiers ?? TAXONOMY_BENCHMARK_TIERS
    const domainCodes = new Set(options?.domainCodes ?? [])
    const discovered = this.discoverFixtures({
      tiers,
      domainCodes: [...domainCodes],
    })

    return discovered.flatMap((fixture) =>
      loadTaxonomyBenchmarkCasesFromFile(fixture.fixtureFile).filter(
        (benchmarkCase) => {
          const tier = benchmarkCase.tier ?? 'tier-0-smoke'
          if (!tiers.includes(tier)) {
            return false
          }
          if (domainCodes.size === 0) {
            return true
          }
          return domainCodes.has(benchmarkCase.l1Code)
        },
      ),
    )
  }

  private evaluateNewPathCase(
    benchmarkCase: TaxonomyBenchmarkCase,
  ): TaxonomyBenchmarkPathEvaluation {
    if (this.services.evaluateNewPathCase) {
      return {
        classification: this.services.evaluateNewPathCase(benchmarkCase),
      }
    }

    if (!this.services.taxonomyClassifierService) {
      return {
        classification: buildUnavailableResult(
          benchmarkCase.l1Code,
          'taxonomy-benchmark-unconfigured',
        ),
      }
    }

    return {
      classification: this.services.taxonomyClassifierService.classifyCaseText({
        rawText: benchmarkCase.caseText,
        preferredL1Code: benchmarkCase.l1Code,
      }),
    }
  }

  private evaluateLegacyPathCase(
    benchmarkCase: TaxonomyBenchmarkCase,
  ): TaxonomyBenchmarkPathEvaluation | null {
    if (this.services.evaluateLegacyPathCase) {
      const classification = this.services.evaluateLegacyPathCase(benchmarkCase)
      if (!classification) {
        return null
      }

      return { classification }
    }

    return {
      classification: buildUnavailableResult(
        benchmarkCase.l1Code,
        'legacy-path-unavailable',
      ),
    }
  }

  private async buildCaseResult(
    benchmarkCase: TaxonomyBenchmarkCase,
    classification: TaxonomyClassificationResult,
  ): Promise<TaxonomyBenchmarkCaseResult> {
    const l2Code = classification.l2Code
    const failureModeResult =
      l2Code == null
        ? { items: [] }
        : await this.services.failureModeService.findByL2Code(l2Code, {
            status: 'ACTIVE',
            limit: 50,
          })
    const chainResult =
      l2Code == null
        ? { items: [], total: 0 }
        : await this.services.caseClusteringChainService.resolveControlPointsByL2Code(
            l2Code,
          )
    const fullChainResult =
      l2Code == null
        ? { l2Code: '', l2Name: '', failureModes: [] }
        : await this.services.controlPointService.findByL2CodeWithFullChain(
            l2Code,
          )

    const actualFailureModeCodes = dedupe(
      failureModeResult.items.map((failureMode) => failureMode.failureModeCode),
    )
    const actualControlCodes = collectActualControlCodes(chainResult as ChainResult)
    const actualEvidence = collectActualEvidence(
      fullChainResult as FullChainResult,
      benchmarkCase.expectedControlCodes,
    )

    const taxonomyHit = l2Code === benchmarkCase.expectedL2Code
    const failureModeHit = includesAll(
      actualFailureModeCodes,
      benchmarkCase.expectedFailureModeCodes,
    )
    const controlHit = includesAll(
      actualControlCodes,
      benchmarkCase.expectedControlCodes,
    )
    const expectedEvidenceCodes = benchmarkCase.expectedEvidenceCodes ?? []
    const expectedEvidenceCategories =
      benchmarkCase.expectedEvidenceCategories ?? []
    const evidenceHit =
      includesAll(actualEvidence.codes, expectedEvidenceCodes) &&
      includesAll(actualEvidence.categories, expectedEvidenceCategories)
    const fullChainHit = taxonomyHit && failureModeHit && controlHit && evidenceHit
    const normalizedRiskTags = normalizeRiskTags(benchmarkCase.riskTags)

    return {
      caseId: benchmarkCase.caseId,
      caseTitle: benchmarkCase.caseTitle,
      l1Code: benchmarkCase.l1Code,
      tier: benchmarkCase.tier ?? 'tier-0-smoke',
      riskTags: normalizedRiskTags,
      expectedL2Code: benchmarkCase.expectedL2Code,
      actualL2Code: l2Code ?? 'UNCLASSIFIED',
      classificationDecisionSource: classification.decisionSource,
      classificationScoreGap: classification.scoreGap,
      classifierVersion: classification.classifierVersion,
      pathDecision: classification.pathDecision,
      failureSemantic: classification.failureSemantics,
      taxonomyHit,
      failureModeHit,
      controlHit,
      evidenceHit,
      fullChainHit,
      missCategory: determineMissCategory(
        taxonomyHit,
        failureModeHit,
        controlHit,
        evidenceHit,
      ),
      matchedClassifierSignals: dedupe([
        ...classification.matchedSignals,
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
      reasonSummary: buildReasonSummary({
        missCategory: determineMissCategory(
          taxonomyHit,
          failureModeHit,
          controlHit,
          evidenceHit,
        ),
        classification,
        benchmarkCase,
        actualFailureModeCodes,
        actualControlCodes,
        actualEvidenceCodes: actualEvidence.codes,
        actualEvidenceCategories: actualEvidence.categories,
      }),
      highRiskFalseNegative:
        normalizedRiskTags.includes('HIGH_RISK') && !taxonomyHit,
      fallbackTriggered:
        classification.pathDecision === 'LEGACY_FALLBACK' ||
        classification.failureSemantics === 'LEGACY_FALLBACK_TRIGGERED',
      sourceFile: benchmarkCase.sourceFile,
    }
  }

  private buildCompareDisagreement(
    benchmarkCase: TaxonomyBenchmarkCase,
    newPath: TaxonomyClassificationResult,
    legacyPath: TaxonomyClassificationResult,
    missCategory: TaxonomyBenchmarkCaseResult['missCategory'],
  ): TaxonomyBenchmarkCompareDisagreement {
    const legacyUnavailable =
      legacyPath.classifierVersion === 'legacy-path-unavailable'
    const compareOutcome =
      legacyUnavailable
        ? 'legacy-unavailable'
        : newPath.l2Code === legacyPath.l2Code &&
            newPath.pathDecision === legacyPath.pathDecision &&
            newPath.failureSemantics === legacyPath.failureSemantics
          ? 'same'
          : 'different'

    return {
      caseId: benchmarkCase.caseId,
      l1Code: benchmarkCase.l1Code,
      tier: benchmarkCase.tier ?? 'tier-0-smoke',
      riskTags: normalizeRiskTags(benchmarkCase.riskTags),
      newPath: {
        l2Code: newPath.l2Code ?? 'UNCLASSIFIED',
        pathDecision: newPath.pathDecision,
        failureSemantic: newPath.failureSemantics,
      },
      legacyPath: {
        l2Code: legacyPath.l2Code ?? 'UNCLASSIFIED',
        pathDecision: legacyPath.pathDecision,
        failureSemantic: legacyPath.failureSemantics,
      },
      missCategory,
      compareOutcome,
      reason:
        compareOutcome === 'same'
          ? 'new path and legacy path resolved to the same taxonomy outcome'
          : legacyUnavailable
            ? 'legacy path is unavailable for this domain and fixture slice'
            : 'new path and legacy path produced different taxonomy or path decisions',
    }
  }
}
