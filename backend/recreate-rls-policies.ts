import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function recreateRLSPolicies() {
  const dataSource = new DataSource(databaseConfig() as any)
  await dataSource.initialize()

  console.log('=== 重新创建RLS策略 ===\n')

  try {
    // 1. 删除现有策略
    console.log('1. 删除现有策略:')
    await dataSource.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON organizations`)
    await dataSource.query(`DROP POLICY IF EXISTS admin_bypass_policy ON organizations`)
    console.log('✓ 已删除现有策略')

    // 2. 重新创建策略（包含WITH CHECK）
    console.log('\n2. 重新创建策略:')
    await dataSource.query(`
      CREATE POLICY tenant_isolation_policy ON organizations
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `)
    console.log('✓ 创建 tenant_isolation_policy')

    await dataSource.query(`
      CREATE POLICY admin_bypass_policy ON organizations
      FOR ALL
      USING (current_setting('app.is_admin', true)::boolean = true)
      WITH CHECK (current_setting('app.is_admin', true)::boolean = true)
    `)
    console.log('✓ 创建 admin_bypass_policy')

    // 3. 验证策略
    console.log('\n3. 验证策略:')
    const policies = await dataSource.query(`
      SELECT
        pol.polname as policy_name,
        pg_get_expr(pol.polqual, pol.polrelid) as using_clause,
        pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_clause
      FROM pg_policy pol
      JOIN pg_class cls ON pol.polrelid = cls.oid
      WHERE cls.relname = 'organizations'
    `)
    console.log('策略详情:', JSON.stringify(policies, null, 2))

    // 4. 测试策略
    console.log('\n4. 测试策略:')

    const tenant1Id = '11111111-1111-1111-1111-111111111111'
    const tenant2Id = '22222222-2222-2222-2222-222222222222'

    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Recreate%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Recreate%'`)

    await dataSource.query(`
      INSERT INTO tenants (id, name, subscription_tier, is_active)
      VALUES
        ('${tenant1Id}', 'RLS Recreate Tenant 1', 'basic', true),
        ('${tenant2Id}', 'RLS Recreate Tenant 2', 'basic', true)
      ON CONFLICT (id) DO NOTHING
    `)

    await dataSource.query(`
      INSERT INTO organizations (id, name, tenant_id)
      VALUES
        (uuid_generate_v4(), 'RLS Recreate Org 1', '${tenant1Id}'),
        (uuid_generate_v4(), 'RLS Recreate Org 2', '${tenant2Id}')
    `)

    // 测试不设置租户
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`RESET app.is_admin`)
    const noTenant = await dataSource.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Recreate%'
    `)
    console.log(`  不设置租户: ${noTenant[0].count} 条 (预期: 0)`)

    // 测试设置租户1
    await dataSource.query(`SET app.current_tenant = '${tenant1Id}'`)
    const withTenant1 = await dataSource.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Recreate%'
    `)
    console.log(`  设置租户1: ${withTenant1[0].count} 条 (预期: 1)`)

    // 测试设置租户2
    await dataSource.query(`SET app.current_tenant = '${tenant2Id}'`)
    const withTenant2 = await dataSource.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Recreate%'
    `)
    console.log(`  设置租户2: ${withTenant2[0].count} 条 (预期: 1)`)

    // 测试管理员模式
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`SET app.is_admin = true`)
    const adminMode = await dataSource.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Recreate%'
    `)
    console.log(`  管理员模式: ${adminMode[0].count} 条 (预期: 2)`)

    // 清理
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`RESET app.is_admin`)
    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Recreate%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Recreate%'`)

    console.log('\n=== 策略重新创建完成 ===')
  } catch (error) {
    console.error('失败:', error)
  } finally {
    await dataSource.destroy()
  }
}

recreateRLSPolicies().catch(console.error)
