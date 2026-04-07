import { NestFactory } from '@nestjs/core'
import { AppModule } from '../src/app.module'
import { ComplianceCaseBackfillService } from '../src/modules/case-import-orchestrator/services/compliance-case-backfill.service'

function parseArgs(argv: string[]): { batchId?: string; caseIds?: string[] } {
  const batchArg = argv.find((arg) => arg.startsWith('--batchId='))
  const caseIdsArg = argv.find((arg) => arg.startsWith('--caseIds='))

  return {
    batchId: batchArg?.split('=')[1],
    caseIds: caseIdsArg?.split('=')[1]?.split(',').map((item) => item.trim()).filter(Boolean),
  }
}

async function main(): Promise<void> {
  const params = parseArgs(process.argv.slice(2))
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  })

  try {
    const service = app.get(ComplianceCaseBackfillService)
    const report = await service.backfill(params)

    console.log('[case:backfill] complete')
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error) => {
  console.error('[case:backfill] failed')
  console.error(error)
  process.exitCode = 1
})
