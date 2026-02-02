import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function fixRLSPolicies() {
  const dataSource = new DataSource(databaseConfig() as any)
  await dataSource.initialize()

  console.log('=== 修复RLS策略 ===\n')

  try {
    // 1. 删除现有策略
    console.log('1. 删除现有策略:')
    await dataSource.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON organizations`)
    await dataSource.query(`DROP POLICY IF EXISTS admin_bypass_policy ON organizations`)
    console.log('✓ 已删除现有策略')

    // 2. 创建新策略（不指定TO子句，默认应用于所有角色）
    console.log('\n2. 创建新策略（应用于所有角色）:')

    // 注意：不使用 TO public，而是不指定TO子句，这样会应用于所有角色包括超级用户
    await dataSource.query(`
      CREATE POLICY tenant_isolation_policy ON organizations
      AS PERMISSIVE
      FOR ALL
      USING (
        tenant_id = current_setting('app.current_tenant', true)::uuid
        OR current_setting('app.is_admin', true)::boolean = true
      )
      WITH CHECK (
        tenant_id = current_setting('app.current_tenant', true)::uuid
        OR current_setting('app.is_admin', true)::boolean = true
      )
    `)
    console.log('✓ 创建 tenant_isolation_policy (合并了admin bypass)')

    // 3. 验证策略
    console.log('\n3. 验证策略:')
    const policies = await dataSource.query(`
      SELECT
        policyname,
        permissive,
        roles,
        cmd,
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

    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Fix%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Fix%'`)

    await dataSource.query(`
      INSERT INTO tenants (id, name, subscription_tier, is_active)
      VALUES
        ('${tenant1Id}', 'RLS Fix Tenant 1', 'basic', true),
        ('${tenant2Id}', 'RLS Fix Tenant 2', 'basic', true)
      ON CONFLICT (id) DO NOTHING
    `)

    await dataSource.query(`
      INSERT INTO organizations (id, name, tenant_id)
      VALUES
        (uuid_generate_v4(), 'RLS Fix Org 1', '${tenant1Id}'),
        (uuid_generate_v4(), 'RLS Fix Org 2', '${tenant2Id}')
    `)

    // 测试1: 不设置租户
    console.log('\n--- 测试1: 不设置租户 ---')
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`RESET app.is_admin`)
    const noTenant = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Fix%'
    `)
    console.log(`返回 ${noTenant.length} 条记录 (预期: 0)`)
    if (noTenant.length === 0) {
      console.log('✓ 测试1通过')
    } else {
      console.log('✗ 测试1失败:', noTenant)
    }

    // 测试2: 设置租户1
    console.log('\n--- 测试2: 设置租户1 ---')
    await dataSource.query(`SET app.current_tenant = '${tenant1Id}'`)
    const withTenant1 = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Fix%'
    `)
    console.log(`返回 ${withTenant1.length} 条记录 (预期: 1)`)
    const allTenant1 = withTenant1.every((r: any) => r.tenant_id === tenant1Id)
    if (withTenant1.length === 1 && allTenant1) {
      console.log('✓ 测试2通过:', withTenant1[0])
    } else {
      console.log('✗ 测试2失败:', withTenant1)
    }

    // 测试3: 设置租户2
    console.log('\n--- 测试3: 设置租户2 ---')
    await dataSource.query(`SET app.current_tenant = '${tenant2Id}'`)
    const withTenant2 = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Fix%'
    `)
    console.log(`返回 ${withTenant2.length} 条记录 (预期: 1)`)
    const allTenant2 = withTenant2.every((r: any) => r.tenant_id === tenant2Id)
    if (withTenant2.length === 1 && allTenant2) {
      console.log('✓ 测试3通过:', withTenant2[0])
    } else {
      console.log('✗ 测试3失败:', withTenant2)
    }

    // 测试4: 管理员模式
    console.log('\n--- 测试4: 管理员模式 ---')
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`SET app.is_admin = true`)
    const adminMode = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Fix%'
    `)
    console.log(`返回 ${adminMode.length} 条记录 (预期: 2)`)
    if (adminMode.length === 2) {
      console.log('✓ 测试4通过')
    } else {
      console.log('✗ 测试4失败:', adminMode)
    }

    // 清理
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`RESET app.is_admin`)
    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Fix%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Fix%'`)

    console.log('\n=== 修复完成 ===')
  } catch (error) {
    console.error('失败:', error)
  } finally {
    await dataSource.destroy()
  }
}

fixRLSPolicies().catch(console.error)
