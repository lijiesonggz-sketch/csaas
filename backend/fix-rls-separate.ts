import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function fixRLSWithSeparatePolicies() {
  const ds = new DataSource(databaseConfig() as any)
  await ds.initialize()

  console.log('=== 修复RLS策略（分离admin bypass）===\n')

  try {
    // 1. 删除现有策略
    console.log('1. 删除现有策略')
    await ds.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON organizations`)
    await ds.query(`DROP POLICY IF EXISTS admin_bypass_policy ON organizations`)

    // 2. 创建租户隔离策略（不包含OR条件）
    console.log('2. 创建租户隔离策略（仅tenant_id条件）')
    await ds.query(`
      CREATE POLICY tenant_isolation_policy ON organizations
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `)

    // 3. 创建admin bypass策略（独立）
    console.log('3. 创建admin bypass策略（独立）')
    await ds.query(`
      CREATE POLICY admin_bypass_policy ON organizations
      FOR ALL
      USING (current_setting('app.is_admin', true)::boolean = true)
      WITH CHECK (current_setting('app.is_admin', true)::boolean = true)
    `)

    // 4. 验证策略
    console.log('\n4. 验证策略')
    const policies = await ds.query(`
      SELECT polname, polpermissive
      FROM pg_policy pol
      JOIN pg_class cls ON pol.polrelid = cls.oid
      WHERE cls.relname = 'organizations'
    `)
    console.log('策略列表:', policies)

    // 5. 测试
    console.log('\n5. 测试策略')

    const tenant1Id = '11111111-1111-1111-1111-111111111111'
    const tenant2Id = '22222222-2222-2222-2222-222222222222'

    await ds.query(`DELETE FROM organizations WHERE name LIKE 'RLS Separate%'`)
    await ds.query(`DELETE FROM tenants WHERE name LIKE 'RLS Separate%'`)

    await ds.query(`
      INSERT INTO tenants (id, name, subscription_tier, is_active)
      VALUES
        ('${tenant1Id}', 'RLS Separate Tenant 1', 'basic', true),
        ('${tenant2Id}', 'RLS Separate Tenant 2', 'basic', true)
      ON CONFLICT (id) DO NOTHING
    `)

    await ds.query(`
      INSERT INTO organizations (id, name, tenant_id)
      VALUES
        (uuid_generate_v4(), 'RLS Separate Org 1', '${tenant1Id}'),
        (uuid_generate_v4(), 'RLS Separate Org 2', '${tenant2Id}')
    `)

    // 测试1: 不设置租户
    console.log('\n--- 测试1: 不设置租户 ---')
    await ds.query(`RESET app.current_tenant`)
    await ds.query(`RESET app.is_admin`)
    const noTenant = await ds.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Separate%'
    `)
    console.log(`结果: ${noTenant[0].count} 条 (预期: 0) ${noTenant[0].count === '0' ? '✓' : '✗'}`)

    // 测试2: 设置租户1
    console.log('\n--- 测试2: 设置租户1 ---')
    await ds.query(`SET app.current_tenant = '${tenant1Id}'`)
    const withTenant1 = await ds.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Separate%'
    `)
    console.log(`结果: ${withTenant1[0].count} 条 (预期: 1) ${withTenant1[0].count === '1' ? '✓' : '✗'}`)

    // 查看查询计划
    console.log('\n查询计划:')
    const plan = await ds.query(`
      EXPLAIN (VERBOSE, COSTS OFF)
      SELECT * FROM organizations WHERE name LIKE 'RLS Separate%'
    `)
    plan.forEach((row: any) => console.log('  ' + row['QUERY PLAN']))

    // 清理
    await ds.query(`RESET app.current_tenant`)
    await ds.query(`RESET app.is_admin`)
    await ds.query(`DELETE FROM organizations WHERE name LIKE 'RLS Separate%'`)
    await ds.query(`DELETE FROM tenants WHERE name LIKE 'RLS Separate%'`)

    console.log('\n=== 完成 ===')
  } catch (error) {
    console.error('失败:', error)
  } finally {
    await ds.destroy()
  }
}

fixRLSWithSeparatePolicies().catch(console.error)
