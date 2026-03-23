import { AppDataSource } from '../src/config/typeorm.config'
import { runKgSeed } from '../src/modules/applicability-engine/seeds/kg-seed.service'

async function main(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize()
  }

  try {
    const summary = await runKgSeed(AppDataSource)

    console.log('[seed:kg] complete')
    console.log(JSON.stringify(summary, null, 2))
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy()
    }
  }
}

main().catch((error) => {
  console.error('[seed:kg] failed')
  console.error(error)
  process.exitCode = 1
})
