import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function explainQuery() {
  const ds = new DataSource(databaseConfig() as any)
  await ds.initialize()

  console.log('=== EXPLAIN查询计划 ===\n')

  try {
    // 设置租户
    const tenantId = '11111111-1111-1111-1111-111111111111'
    await ds.query(`SET app.current_tenant = '${tenantId}'`)

    // 查看查询计划
    const plan = await ds.query(`
      EXPLAIN (VERBOSE, COSTS OFF)
      SELECT * FROM organizations LIMIT 5
    `)

    console.log('查询计划:')
    plan.forEach((row: any) => console.log(row['QUERY PLAN']))

    console.log('\n如果查询计划中包含"Filter"或"RLS"相关内容，说明RLS策略被应用')
    console.log('如果没有，说明RLS策略未被应用到查询计划中')

    await ds.destroy()
  } catch (error) {
    console.error('失败:', error)
    await ds.destroy()
  }
}

explainQuery().catch(console.error)
