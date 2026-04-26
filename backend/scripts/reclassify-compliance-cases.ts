import { NestFactory } from '@nestjs/core'
import { AppModule } from '../src/app.module'
import {
  ComplianceCaseReclassificationService,
  type ComplianceCaseReclassificationParams,
} from '../src/modules/case-import-orchestrator/services/compliance-case-reclassification.service'

export function parseArgs(
  argv: string[],
): ComplianceCaseReclassificationParams {
  const readValue = (...keys: string[]) => {
    for (const key of keys) {
      const matched = argv.find((arg) => arg.startsWith(`${key}=`))
      if (matched) {
        return matched.split('=').slice(1).join('=')
      }
    }

    return undefined
  }

  const parseBoolean = (value: string | undefined): boolean | undefined => {
    if (value === undefined) {
      return undefined
    }

    const normalized = value.toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false
    }

    throw new Error(`Invalid boolean flag value: ${value}`)
  }

  const parseNumber = (value: string | undefined): number | undefined => {
    if (value === undefined) {
      return undefined
    }

    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`Invalid numeric flag value: ${value}`)
    }

    return parsed
  }

  const caseIds = readValue('--caseIds', '--case-ids')

  return {
    batchId: readValue('--batchId', '--batch-id'),
    caseIds: caseIds
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    l1Code: readValue('--domain', '--l1-code'),
    classifierVersion: readValue(
      '--classifierVersion',
      '--classifier-version',
    ),
    shadowOnly: parseBoolean(readValue('--shadowOnly', '--shadow-only')),
    forceLatestPointer: parseBoolean(
      readValue('--forceLatestPointer', '--force-latest-pointer'),
    ),
    dryRun: parseBoolean(readValue('--dryRun', '--dry-run')),
    limit: parseNumber(readValue('--limit')),
    offset: parseNumber(readValue('--offset')),
  }
}

export async function main(): Promise<void> {
  const params = parseArgs(process.argv.slice(2))
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  })

  try {
    const service = app.get(ComplianceCaseReclassificationService)
    const report = await service.reclassify(params)

    console.log('[case:reclassify] complete')
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await app.close()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[case:reclassify] failed')
    console.error(error)
    process.exitCode = 1
  })
}
