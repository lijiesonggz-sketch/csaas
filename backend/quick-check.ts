import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function quickCheck() {
  const ds = new DataSource(databaseConfig() as any)
  await ds.initialize()

  console.log('=== 快速检查 ===\n')

  // 1. BYPASSRLS
  const bypass = await ds.query(`SELECT rolbypassrls FROM pg_roles WHERE rolname = 'postgres'`)
  console.log('1. postgres BYPASSRLS:', bypass[0].rolbypassrls)

  // 2. FORCE RLS
  const force = await ds.query(`
    SELECT relforcerowsecurity FROM pg_class WHERE relname = 'organizations'
  `)
  console.log('2. organizations FORCE RLS:', force[0].relforcerowsecurity)

  // 3. 策略数量
  const count = await ds.query(`SELECT COUNT(*) FROM pg_policies WHERE tablename = 'organizations'`)
  console.log('3. 策略数量:', count[0].count)

  await ds.destroy()
}

quickCheck().catch(console.error)
