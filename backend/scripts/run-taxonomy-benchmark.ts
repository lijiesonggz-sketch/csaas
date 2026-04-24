import { AppDataSource } from '../src/config/typeorm.config'
import { ControlPackItem } from '../src/database/entities/control-pack-item.entity'
import { ControlPoint } from '../src/database/entities/control-point.entity'
import { FailureModeControlMap } from '../src/database/entities/failure-mode-control-map.entity'
import { FailureMode } from '../src/database/entities/failure-mode.entity'
import { TaxonomyFailureModeMap } from '../src/database/entities/taxonomy-failure-mode-map.entity'
import { TaxonomyL1 } from '../src/database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../src/database/entities/taxonomy-l2.entity'
import { CaseClusteringChainService } from '../src/modules/case-import-orchestrator/services/case-clustering-chain.service'
import {
  classifyIt04CaseText,
  type It04ClassificationResult,
  loadIt04TaxonomyMappings,
} from '../src/modules/case-import-orchestrator/services/it04-benchmark.runner'
import {
  TaxonomyBenchmarkMode,
  TaxonomyBenchmarkRunner,
  TaxonomyBenchmarkTier,
} from '../src/modules/case-import-orchestrator/services/taxonomy-benchmark.runner'
import type { TaxonomyClassificationResult } from '../src/modules/case-import-orchestrator/services/taxonomy-classification/contracts/classification-result.contract'
import { CaseNormalizationService } from '../src/modules/case-import-orchestrator/services/taxonomy-classification/case-normalization.service'
import { CsvBackedMappingRepository } from '../src/modules/case-import-orchestrator/services/taxonomy-classification/csv-backed-mapping.repository'
import { TaxonomyClassifierEngine } from '../src/modules/case-import-orchestrator/services/taxonomy-classification/taxonomy-classifier.engine'
import { TaxonomyClassifierService } from '../src/modules/case-import-orchestrator/services/taxonomy-classification/taxonomy-classifier.service'
import { IT04_RULEBOOK } from '../src/modules/case-import-orchestrator/services/taxonomy-classification/rulebooks/it04.rulebook'
import { ControlPointService } from '../src/modules/knowledge-graph/services/control-point.service'
import { FailureModeService } from '../src/modules/knowledge-graph/services/failure-mode.service'

export const SCRIPT_GATE_THRESHOLDS = {
  taxonomyPrecision: 0.7,
  taxonomyRecall: 0.7,
  fullChainHitRate: 0.6,
  highRiskFalseNegativeRate: 0.1,
  fallbackTriggerRate: 0.25,
} as const

export function parseListEnv(value: string | undefined): string[] | undefined {
  const parsed = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  return parsed.length > 0 ? parsed : undefined
}

export function parseModeEnv(value: string | undefined): TaxonomyBenchmarkMode {
  if (!value) {
    return 'new-path'
  }

  if (
    value === 'legacy-path' ||
    value === 'dual-path-compare' ||
    value === 'new-path'
  ) {
    return value
  }

  throw new Error(`Invalid benchmark mode: ${value}`)
}

export function parseTierEnv(value: string | undefined): TaxonomyBenchmarkTier[] | undefined {
  if (!value) {
    return undefined
  }

  const requestedTiers = parseListEnv(value) ?? []
  const tiers = requestedTiers.filter(
    (entry): entry is TaxonomyBenchmarkTier =>
      entry === 'tier-0-smoke' ||
      entry === 'tier-1-cutover' ||
      entry === 'tier-2-holdout',
  )

  if (tiers.length === 0 || tiers.length !== requestedTiers.length) {
    throw new Error(`Invalid benchmark tiers: ${value}`)
  }

  return tiers
}

export function mapLegacyIt04BenchmarkResult(args: {
  legacy: It04ClassificationResult
  mappingVersion: string
  rulebookVersion: string
  classifierVersion?: string
}): TaxonomyClassificationResult {
  const classifierVersion = args.classifierVersion ?? 'legacy-it04-benchmark'

  return {
    l1Code: 'IT04',
    l2Code: args.legacy.l2Code,
    l2Name: args.legacy.l2Name,
    score: args.legacy.score,
    confidenceScore: args.legacy.score,
    scoreGap: args.legacy.scoreGap,
    decisionSource: args.legacy.decisionSource,
    matchedSignals: [...args.legacy.matchedPhrases, ...args.legacy.matchedTokens],
    matchedPhrases: args.legacy.matchedPhrases,
    matchedTokens: args.legacy.matchedTokens,
    classifierVersion,
    mappingVersion: args.mappingVersion,
    rulebookVersion: args.rulebookVersion,
    classifiedAt: new Date().toISOString(),
    pathDecision: args.legacy.l2Code ? 'LEGACY_FALLBACK' : 'UNCLASSIFIED',
    failureSemantics: args.legacy.l2Code
      ? 'LEGACY_FALLBACK_TRIGGERED'
      : 'NO_MATCH',
  }
}

export async function main(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize()
  }

  try {
    const failureModeService = new FailureModeService(
      AppDataSource.getRepository(FailureMode),
      AppDataSource.getRepository(TaxonomyFailureModeMap),
      AppDataSource.getRepository(FailureModeControlMap),
      AppDataSource.getRepository(TaxonomyL2),
      AppDataSource.getRepository(ControlPoint),
    )
    const controlPointService = new ControlPointService(
      AppDataSource.getRepository(ControlPoint),
      AppDataSource.getRepository(TaxonomyL1),
      AppDataSource.getRepository(TaxonomyL2),
      AppDataSource.getRepository(FailureModeControlMap),
      AppDataSource.getRepository(TaxonomyFailureModeMap),
      AppDataSource.getRepository(ControlPackItem),
    )
    const caseClusteringChainService = new CaseClusteringChainService(
      failureModeService,
      {
        upsertCaseControlMap: async () => undefined,
      } as never,
    )

    const mappingRepository = new CsvBackedMappingRepository()
    const taxonomyClassifierService = new TaxonomyClassifierService(
      new CaseNormalizationService(),
      mappingRepository,
      new TaxonomyClassifierEngine(),
    )
    const mappingVersion = mappingRepository.getVersion()
    let it04Mappings: ReturnType<typeof loadIt04TaxonomyMappings> | null = null

    const mode = parseModeEnv(process.env.CSAAS_TAXONOMY_BENCHMARK_MODE)
    const domainCodes = parseListEnv(process.env.CSAAS_TAXONOMY_BENCHMARK_DOMAINS)
    const tiers = parseTierEnv(process.env.CSAAS_TAXONOMY_BENCHMARK_TIERS)

    const runner = new TaxonomyBenchmarkRunner({
      taxonomyClassifierService,
      evaluateLegacyPathCase:
        mode === 'new-path'
          ? undefined
          : (benchmarkCase) => {
              if (benchmarkCase.l1Code !== 'IT04') {
                return null
              }

              if (!it04Mappings) {
                it04Mappings = loadIt04TaxonomyMappings()
              }

              const legacy = classifyIt04CaseText(
                benchmarkCase.caseText,
                it04Mappings,
                mappingVersion,
              )

              return mapLegacyIt04BenchmarkResult({
                legacy,
                mappingVersion,
                rulebookVersion: IT04_RULEBOOK.version,
              })
            },
      failureModeService,
      controlPointService,
      caseClusteringChainService,
    })

    const report = await runner.runBenchmark({
      mode,
      domainCodes,
      tiers,
      writeReport: true,
      thresholds: SCRIPT_GATE_THRESHOLDS,
    })

    console.log(`[benchmark:taxonomy] complete (${mode})`)
    console.log(
      JSON.stringify(
        {
          summary: report.summary,
          markdownPath: report.markdownPath,
          jsonPath: report.jsonPath,
          machineSummaryPath: report.machineSummaryPath,
        },
        null,
        2,
      ),
    )

    if (report.summary.gateStatus !== 'PASS') {
      throw new Error(
        `taxonomy benchmark gate failed: ${report.summary.reasons.join('; ')}`,
      )
    }
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy()
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[benchmark:taxonomy] failed')
    console.error(error)
    process.exitCode = 1
  })
}
