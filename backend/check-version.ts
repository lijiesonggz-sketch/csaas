import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function checkVersion() {
  const ds = new DataSource(databaseConfig() as any)
  await ds.initialize()

  const version = await ds.query('SELECT version()')
  console.log('PostgreSQL版本:')
  console.log(version[0].version)

  await ds.destroy()
}

checkVersion().catch(console.error)
