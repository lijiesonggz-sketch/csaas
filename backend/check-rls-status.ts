import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function checkRLSStatus() {
  const dataSource = new DataSource(databaseConfig() as any)
  await dataSource.initialize()

  console.log('=== 检查RLS状态 ===\n')

  try {
    // 1. 检查表的RLS是否启用
    console.log('1. 检查RLS是否启用:')
    const rlsStatus = await dataSource.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename = 'organizations'
    `)
    console.log('Organizations表:', rlsStatus)

    // 2. 检查策略是否存在
    console.log('\n2. 检查RLS策略:')
    const policies = await dataSource.query(`
      SELECT policyname, cmd, permissive, roles, qual, with_check
      FROM pg_policies
      WHERE tablename = 'organizations'
    `)
    console.log('策略列表:', JSON.stringify(policies, null, 2))

    // 3. 检查当前用户角色
    console.log('\n3. 检查当前用户:')
    const currentUser = await dataSource.query(`SELECT current_user, session_user`)
    console.log('当前用户:', currentUser)

    // 4. 检查用户是否是表的所有者
    console.log('\n4. 检查表所有者:')
    const tableOwner = await dataSource.query(`
      SELECT tableowner
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename = 'organizations'
    `)
    console.log('表所有者:', tableOwner)

    // 5. 检查是否有BYPASSRLS权限
    console.log('\n5. 检查BYPASSRLS权限:')
    const bypassRLS = await dataSource.query(`
      SELECT rolname, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
    `)
    console.log('当前用户权限:', bypassRLS)

    // 6. 测试策略是否真的应用
    console.log('\n6. 测试RLS策略应用:')

    // 创建测试数据
    const tenant1Id = '11111111-1111-1111-1111-111111111111'
    const tenant2Id = '22222222-2222-2222-2222-222222222222'

    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Check%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Check%'`)

    await dataSource.query(`
      INSERT INTO tenants (id, name, subscription_tier, is_active)
      VALUES
        ('${tenant1Id}', 'RLS Check Tenant 1', 'basic', true),
        ('${tenant2Id}', 'RLS Check Tenant 2', 'basic', true)
      ON CONFLICT (id) DO NOTHING
    `)

    await dataSource.query(`
      INSERT INTO organizations (id, name, tenant_id)
      VALUES
        (uuid_generate_v4(), 'RLS Check Org 1', '${tenant1Id}'),
        (uuid_generate_v4(), 'RLS Check Org 2', '${tenant2Id}')
    `)

    // 测试不设置租户
    await dataSource.query(`RESET app.current_tenant`)
    const noTenant = await dataSource.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Check%'
    `)
    console.log(`  不设置租户: ${noTenant[0].count} 条 (预期: 0)`)

    // 测试设置租户
    await dataSource.query(`SET app.current_tenant = '${tenant1Id}'`)
    const withTenant = await dataSource.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Check%'
    `)
    console.log(`  设置租户1: ${withTenant[0].count} 条 (预期: 1)`)

    // 7. 检查策略的USING子句
    console.log('\n7. 检查策略USING子句:')
    const policyDetails = await dataSource.query(`
      SELECT
        pol.polname as policy_name,
        pg_get_expr(pol.polqual, pol.polrelid) as using_clause,
        pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_clause
      FROM pg_policy pol
      JOIN pg_class cls ON pol.polrelid = cls.oid
      WHERE cls.relname = 'organizations'
    `)
    console.log('策略详情:', JSON.stringify(policyDetails, null, 2))

    // 清理
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Check%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Check%'`)

    console.log('\n=== 检查完成 ===')
  } catch (error) {
    console.error('检查失败:', error)
  } finally {
    await dataSource.destroy()
  }
}

checkRLSStatus().catch(console.error)
