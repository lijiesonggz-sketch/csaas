import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function testFixedRLS() {
  const dataSource = new DataSource(databaseConfig() as any)
  await dataSource.initialize()

  console.log('=== 测试修复后的RLS策略 ===\n')

  try {
    const tenant1Id = '11111111-1111-1111-1111-111111111111'
    const tenant2Id = '22222222-2222-2222-2222-222222222222'

    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Test%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Test%'`)

    await dataSource.query(`
      INSERT INTO tenants (id, name, subscription_tier, is_active)
      VALUES
        ('${tenant1Id}', 'RLS Test Tenant 1', 'basic', true),
        ('${tenant2Id}', 'RLS Test Tenant 2', 'basic', true)
      ON CONFLICT (id) DO NOTHING
    `)

    await dataSource.query(`
      INSERT INTO organizations (id, name, tenant_id)
      VALUES
        (uuid_generate_v4(), 'RLS Test Org 1', '${tenant1Id}'),
        (uuid_generate_v4(), 'RLS Test Org 2', '${tenant2Id}')
    `)

    // 测试1: 不设置租户
    console.log('测试1: 不设置租户')
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`RESET app.is_admin`)
    const noTenant = await dataSource.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Test%'
    `)
    console.log(`  结果: ${noTenant[0].count} 条 (预期: 0) ${noTenant[0].count === '0' ? '✓' : '✗'}`)

    // 测试2: 设置租户1
    console.log('\n测试2: 设置租户1')
    await dataSource.query(`SET app.current_tenant = '${tenant1Id}'`)
    const withTenant1 = await dataSource.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Test%'
    `)
    console.log(`  结果: ${withTenant1[0].count} 条 (预期: 1) ${withTenant1[0].count === '1' ? '✓' : '✗'}`)

    // 测试3: 设置租户2
    console.log('\n测试3: 设置租户2')
    await dataSource.query(`SET app.current_tenant = '${tenant2Id}'`)
    const withTenant2 = await dataSource.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Test%'
    `)
    console.log(`  结果: ${withTenant2[0].count} 条 (预期: 1) ${withTenant2[0].count === '1' ? '✓' : '✗'}`)

    // 测试4: 管理员模式
    console.log('\n测试4: 管理员模式')
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`SET app.is_admin = true`)
    const adminMode = await dataSource.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Test%'
    `)
    console.log(`  结果: ${adminMode[0].count} 条 (预期: 2) ${adminMode[0].count === '2' ? '✓' : '✗'}`)

    // 清理
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`RESET app.is_admin`)
    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Test%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Test%'`)

    console.log('\n=== 测试完成 ===')
  } catch (error) {
    console.error('失败:', error)
  } finally {
    await dataSource.destroy()
  }
}

testFixedRLS().catch(console.error)
