import { AppDataSource } from '../src/config/typeorm.config'
import { ControlPackItem } from '../src/database/entities/control-pack-item.entity'
import { ControlPoint } from '../src/database/entities/control-point.entity'
import { FailureModeControlMap } from '../src/database/entities/failure-mode-control-map.entity'
import { FailureMode } from '../src/database/entities/failure-mode.entity'
import { TaxonomyFailureModeMap } from '../src/database/entities/taxonomy-failure-mode-map.entity'
import { TaxonomyL1 } from '../src/database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../src/database/entities/taxonomy-l2.entity'
import { CaseClusteringChainService } from '../src/modules/case-import-orchestrator/services/case-clustering-chain.service'
import { It04BenchmarkRunner } from '../src/modules/case-import-orchestrator/services/it04-benchmark.runner'
import { ControlPointService } from '../src/modules/knowledge-graph/services/control-point.service'
import { FailureModeService } from '../src/modules/knowledge-graph/services/failure-mode.service'

const minFullChainHits = Number(process.env.CSAAS_IT04_BENCHMARK_MIN_HITS || 10)

async function main(): Promise<void> {
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

    const runner = new It04BenchmarkRunner({
      failureModeService,
      controlPointService,
      caseClusteringChainService,
    })
    const report = await runner.runBenchmark({
      writeReport: true,
      minFullChainHits,
    })

    console.log('[benchmark:it04] complete')
    console.log(
      JSON.stringify(
        {
          summary: report.summary,
          markdownPath: report.markdownPath,
          jsonPath: report.jsonPath,
        },
        null,
        2,
      ),
    )

    if (!report.summary.meetsGate) {
      throw new Error(
        `IT04 benchmark gate failed: ${report.summary.fullChainHitCount}/${report.summary.minFullChainHits} full-chain hits`,
      )
    }
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy()
    }
  }
}

main().catch((error) => {
  console.error('[benchmark:it04] failed')
  console.error(error)
  process.exitCode = 1
})
