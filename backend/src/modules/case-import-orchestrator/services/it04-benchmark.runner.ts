import * as fs from 'fs'
import * as path from 'path'
import * as Papa from 'papaparse'
import { ControlPointService, FullChainResult } from '../../knowledge-graph/services/control-point.service'
import { FailureModeService } from '../../knowledge-graph/services/failure-mode.service'
import { tokenizeText } from './case-theme.utils'
import { CaseClusteringChainService, ChainResult } from './case-clustering-chain.service'

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
const IT04_FALLBACK_BUCKET_CODE = 'IT04-05'

type It04RuleSignal = {
  label: string
  pattern: RegExp
  weight: number
}

type It04RulebookEntry = {
  l2Code: string
  signals: It04RuleSignal[]
}

const IT04_RULEBOOK: It04RulebookEntry[] = [
  {
    l2Code: 'IT04-07',
    signals: [
      { label: '未按时报送', pattern: /未按时报送|未按期报送/, weight: 5 },
      { label: '迟报未报', pattern: /迟报|未报|漏报/, weight: 4 },
      { label: '超期逾期', pattern: /超期|逾期/, weight: 4 },
      { label: '截止时点', pattern: /截止时间|截止日|截止时点/, weight: 4 },
      { label: '时效预警', pattern: /时效监控|时效预警|催办|升级机制|提醒机制/, weight: 4 },
      { label: '科技监管台账', pattern: /台账报送|科技监管类报表|非现场监管报表/, weight: 3 },
    ],
  },
  {
    l2Code: 'IT04-04',
    signals: [
      { label: '数据质量不符合规范', pattern: /数据质量不符合规范|数据质量问题/, weight: 5 },
      { label: '自动化校验', pattern: /自动化数据质量校验|数据质量校验规则|自动化校验|质检/, weight: 5 },
      { label: '阻断异常', pattern: /阻断异常报送|异常字段|关键字段缺失|字段偏差/, weight: 4 },
      { label: '口径错误', pattern: /口径错误|格式错误/, weight: 4 },
    ],
  },
  {
    l2Code: 'IT04-06',
    signals: [
      { label: '账表核对', pattern: /账表核对|账表不一致|账实不符/, weight: 5 },
      { label: '总分账勾稽', pattern: /总账|分账|勾稽|账簿/, weight: 4 },
      { label: '系统间不一致', pattern: /系统间数据不一致|源系统.*不一致|基础数据不一致|对账差异/, weight: 5 },
      { label: '一致性追溯', pattern: /一致性校验|来源一致性|无法追溯/, weight: 4 },
    ],
  },
  {
    l2Code: 'IT04-08',
    signals: [
      { label: '整改不到位', pattern: /整改不到位|整改未执行|整改方案未落实/, weight: 5 },
      { label: '整改闭环', pattern: /整改闭环|关闭验证|闭环验证缺失/, weight: 5 },
      { label: '历史问题', pattern: /历史问题|历史数据问题|既往.*问题/, weight: 4 },
      { label: '屡查屡犯', pattern: /屡查屡犯|反复发生/, weight: 5 },
      { label: '整改跟踪', pattern: /整改跟踪|整改台账|关闭证明/, weight: 4 },
    ],
  },
  {
    l2Code: 'IT04-10',
    signals: [
      { label: '登记录入更新', pattern: /信息登记|登记信息|录入|补录|更新|维护/, weight: 4 },
      { label: '更新不及时', pattern: /不及时不规范|更新不及时|录入不及时|维护不及时|补录超期/, weight: 5 },
      { label: '业务信息', pattern: /业务信息|投保信息/, weight: 4 },
    ],
  },
  {
    l2Code: 'IT04-11',
    signals: [
      { label: '虚假报送', pattern: /虚假报表|虚假报告|虚假资料|虚假记载/, weight: 5 },
      { label: '数据造假', pattern: /数据造假|人为数据造假|虚假填报/, weight: 5 },
      { label: '真实性审核', pattern: /真实性审核|真实性抽查|真实性/, weight: 4 },
      { label: '人工调整', pattern: /人工调整/, weight: 4 },
      { label: '严重失真', pattern: /严重失真|严重偏离|与实际严重偏离/, weight: 5 },
    ],
  },
  {
    l2Code: 'IT04-03',
    signals: [
      { label: 'EAST错报漏报', pattern: /EAST.*错报|EAST.*漏报|EAST.*报送不实/, weight: 5 },
      { label: '口径配置变更', pattern: /口径定义错误|参数配置|配置变更/, weight: 4 },
      { label: 'EAST报送', pattern: /EAST报送|监管标准化数据EAST/, weight: 3 },
    ],
  },
  {
    l2Code: IT04_FALLBACK_BUCKET_CODE,
    signals: [
      { label: '监管报表', pattern: /监管报表|监管系统报送/, weight: 3 },
      { label: '统计差错', pattern: /统计数据错报|与事实不符|报送数据不准确/, weight: 3 },
      { label: '双人复核', pattern: /双人复核|复核缺失/, weight: 2 },
    ],
  },
]

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
  scoreGap: number
  decisionSource: 'rule' | 'semantic'
  matchedPhrases: string[]
  matchedTokens: string[]
}

export type It04BenchmarkCaseResult = {
  caseId: string
  caseTitle: string
  expectedL2Code: string
  actualL2Code: string
  classificationDecisionSource: 'rule' | 'semantic'
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
  const taxonomyCandidates =
    taxonomyMappingPath === DEFAULT_TAXONOMY_MAPPING_PATH
      ? DEFAULT_TAXONOMY_MAPPING_RESOLUTION.candidates
      : [taxonomyMappingPath]
  const csv = readRequiredFile(
    taxonomyMappingPath,
    'IT04 taxonomy semantic mapping',
    taxonomyCandidates,
  )
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

function scoreIt04RuleSignals(caseText: string): Array<{
  l2Code: string
  score: number
  matchedSignals: string[]
}> {
  return IT04_RULEBOOK.map((entry) => {
    const matchedSignals = entry.signals
      .filter((signal) => signal.pattern.test(caseText))
      .map((signal) => signal.label)
    const score = entry.signals
      .filter((signal) => signal.pattern.test(caseText))
      .reduce((sum, signal) => sum + signal.weight, 0)

    return {
      l2Code: entry.l2Code,
      score,
      matchedSignals,
    }
  }).filter((entry) => entry.score > 0)
}

export function classifyIt04CaseText(
  caseText: string,
  mappings: It04TaxonomySemanticMapping[],
): It04ClassificationResult {
  const normalizedText = normalizeText(caseText)
  const textTokens = tokenizeText(caseText)
  const ruleMatches = scoreIt04RuleSignals(caseText)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (left.l2Code === IT04_FALLBACK_BUCKET_CODE) {
        return 1
      }
      if (right.l2Code === IT04_FALLBACK_BUCKET_CODE) {
        return -1
      }

      return left.l2Code.localeCompare(right.l2Code)
    })

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

    if (mapping.l2Code === IT04_FALLBACK_BUCKET_CODE) {
      score -= 1.5
    }

    return {
      mapping,
      score,
      matchedPhrases: matchedPhrases.slice(0, 8),
      matchedTokens: matchedTokens.slice(0, 10),
    }
  }).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }

    if (right.matchedPhrases.length !== left.matchedPhrases.length) {
      return right.matchedPhrases.length - left.matchedPhrases.length
    }

    if (left.mapping.l2Code === IT04_FALLBACK_BUCKET_CODE) {
      return 1
    }
    if (right.mapping.l2Code === IT04_FALLBACK_BUCKET_CODE) {
      return -1
    }

    return left.mapping.l2Code.localeCompare(right.mapping.l2Code)
  })

  const bestSemantic = scoredMappings[0]
  const secondSemantic = scoredMappings[1]
  const bestRule = ruleMatches[0]
  const secondRule = ruleMatches[1]

  if (bestRule && bestRule.score >= 4) {
    const mapped = mappings.find((mapping) => mapping.l2Code === bestRule.l2Code)
    return {
      l2Code: bestRule.l2Code,
      l2Name: mapped?.l2Name ?? bestRule.l2Code,
      score: Number(bestRule.score.toFixed(2)),
      scoreGap: Number((bestRule.score - (secondRule?.score ?? 0)).toFixed(2)),
      decisionSource: 'rule',
      matchedPhrases: bestRule.matchedSignals,
      matchedTokens: [],
    }
  }

  return {
    l2Code: bestSemantic.mapping.l2Code,
    l2Name: bestSemantic.mapping.l2Name,
    score: Number(bestSemantic.score.toFixed(2)),
    scoreGap: Number((bestSemantic.score - (secondSemantic?.score ?? 0)).toFixed(2)),
    decisionSource: 'semantic',
    matchedPhrases: bestSemantic.matchedPhrases,
    matchedTokens: bestSemantic.matchedTokens,
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
