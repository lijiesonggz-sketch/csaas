import { DataSource, type DataSourceOptions } from 'typeorm'
import { databaseConfig } from '../src/config/database.config'
import { AppDataSource } from '../src/config/typeorm.config'
import { APP_ENTITY_NAMES } from '../src/config/typeorm.entities'

async function buildMetadatasOnly(dataSource: DataSource): Promise<void> {
  await (dataSource as unknown as { buildMetadatas: () => Promise<void> }).buildMetadatas()
}

async function verifyMetadata(name: string, options: DataSourceOptions): Promise<void> {
  const dataSource = new DataSource({
    ...options,
    logging: false,
  })

  try {
    await buildMetadatasOnly(dataSource)
    console.log(`[orm:metadata:check] ${name}: OK (${dataSource.entityMetadatas.length} entities)`)
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy()
    }
  }
}

async function main(): Promise<void> {
  console.log('[orm:metadata:check] verifying entity metadata without opening database connections')
  console.log(`[orm:metadata:check] entity roster: ${APP_ENTITY_NAMES.length}`)

  await verifyMetadata('runtime databaseConfig', databaseConfig() as DataSourceOptions)
  await verifyMetadata('script AppDataSource', AppDataSource.options as DataSourceOptions)

  console.log('[orm:metadata:check] all metadata checks passed')
}

main().catch((error) => {
  console.error('[orm:metadata:check] failed')
  console.error(error)
  process.exitCode = 1
})
