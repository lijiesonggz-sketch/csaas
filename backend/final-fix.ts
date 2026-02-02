import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function finalFix() {
  const ds = new DataSource(databaseConfig() as any)
  await ds.initialize()

  console.log('=== 最终修复尝试 ===\n')

  try {
    // 1. 删除所有策略
    console.log('1. 删除所有策略')
    await ds.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON organizations`)
    await ds.query(`DROP POLICY IF EXISTS admin_bypass_policy ON organizations`)

    // 2. 禁用RLS
    console.log('2. 禁用RLS')
    await ds.query(`ALTER TABLE organizations DISABLE ROW LEVEL SECURITY`)

    // 3. 重新启用RLS
    console.log('3. 重新启用RLS')
    await ds.query(`ALTER TABLE organizations ENABLE ROW LEVEL SECURITY`)

    // 4. 启用FORCE RLS
    console.log('4. 启用FORCE RLS')
    await ds.query(`ALTER TABLE organizations FORCE ROW LEVEL SECURITY`)

    // 5. 创建策略（明确指定TO postgres）
    console.log('5. 创建策略（明确指定TO postgres）')
    await ds.query(`
      CREATE POLICY tenant_isolation_policy ON organizations
      FOR ALL
      TO postgres
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `)

    await ds.query(`
      CREATE POLICY admin_bypass_policy ON organizations
      FOR ALL
      TO postgres
      USING (current_setting('app.is_admin', true)::boolean = true)
      WITH CHECK (current_setting('app.is_admin', true)::boolean = true)
    `)

    // 6. 测试
    console.log('\n6. 测试')

    const tenantId = '11111111-1111-1111-1111-111111111111'

    await ds.query(`DELETE FROM organizations WHERE name = 'Final Test Org'`)
    await ds.query(`DELETE FROM tenants WHERE name = 'Final Test Tenant'`)

    await ds.query(`
      INSERT INTO tenants (id, name, subscription_tier, is_active)
      VALUES ('${tenantId}', 'Final Test Tenant', 'basic', true)
      ON CONFLICT (id) DO NOTHING
    `)

    await ds.query(`
      INSERT INTO organizations (id, name, tenant_id)
      VALUES (uuid_generate_v4(), 'Final Test Org', '${tenantId}')
    `)

    // 不设置租户
    await ds.query(`RESET app.current_tenant`)
    await ds.query(`RESET app.is_admin`)
    const test1 = await ds.query(`SELECT COUNT(*) FROM organizations WHERE name = 'Final Test Org'`)
    console.log(`不设置租户: ${test1[0].count} 条 (预期: 0) ${test1[0].count === '0' ? '✓' : '✗'}`)

    // 设置租户
    await ds.query(`SET app.current_tenant = '${tenantId}'`)
    const test2 = await ds.query(`SELECT COUNT(*) FROM organizations WHERE name = 'Final Test Org'`)
    console.log(`设置租户: ${test2[0].count} 条 (预期: 1) ${test2[0].count === '1' ? '✓' : '✗'}`)

    // 查看查询计划
    console.log('\n查询计划:')
    const plan = await ds.query(`EXPLAIN SELECT * FROM organizations WHERE name = 'Final Test Org'`)
    plan.forEach((row: any) => console.log('  ' + row['QUERY PLAN']))

    // 清理
    await ds.query(`RESET app.current_tenant`)
    await ds.query(`DELETE FROM organizations WHERE name = 'Final Test Org'`)
    await ds.query(`DELETE FROM tenants WHERE name = 'Final Test Tenant'`)

    console.log('\n=== 完成 ===')
  } catch (error) {
    console.error('失败:', error)
  } finally {
    await ds.destroy()
  }
}

finalFix().catch(console.error)
