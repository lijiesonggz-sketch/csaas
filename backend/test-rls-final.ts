import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function testRLSWithoutBypass() {
  const dataSource = new DataSource(databaseConfig() as any)
  await dataSource.initialize()

  console.log('=== 测试RLS策略（移除BYPASSRLS权限）===\n')

  try {
    // 1. 临时移除postgres用户的BYPASSRLS权限
    console.log('1. 移除BYPASSRLS权限:')
    await dataSource.query(`ALTER USER postgres NOBYPASSRLS`)
    console.log('✓ 已移除postgres用户的BYPASSRLS权限')

    // 2. 验证权限已移除
    const checkBypass = await dataSource.query(`
      SELECT rolname, rolbypassrls
      FROM pg_roles
      WHERE rolname = 'postgres'
    `)
    console.log('当前权限:', checkBypass)

    // 3. 创建测试数据
    const tenant1Id = '11111111-1111-1111-1111-111111111111'
    const tenant2Id = '22222222-2222-2222-2222-222222222222'

    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Final%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Final%'`)

    await dataSource.query(`
      INSERT INTO tenants (id, name, subscription_tier, is_active)
      VALUES
        ('${tenant1Id}', 'RLS Final Tenant 1', 'basic', true),
        ('${tenant2Id}', 'RLS Final Tenant 2', 'basic', true)
      ON CONFLICT (id) DO NOTHING
    `)

    await dataSource.query(`
      INSERT INTO organizations (id, name, tenant_id)
      VALUES
        (uuid_generate_v4(), 'RLS Final Org 1', '${tenant1Id}'),
        (uuid_generate_v4(), 'RLS Final Org 2', '${tenant2Id}')
    `)

    console.log('\n2. 测试RLS策略:')

    // 测试1: 不设置租户
    console.log('\n--- 测试1: 不设置租户 ---')
    await dataSource.query(`RESET app.current_tenant`)
    const noTenant = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Final%'
    `)
    console.log(`返回 ${noTenant.length} 条记录 (预期: 0)`)
    if (noTenant.length === 0) {
      console.log('✓ 测试1通过: RLS策略阻止了未设置租户的查询')
    } else {
      console.log('✗ 测试1失败: RLS策略未生效')
      console.log('返回的数据:', noTenant)
    }

    // 测试2: 设置租户1
    console.log('\n--- 测试2: 设置租户1 ---')
    await dataSource.query(`SET app.current_tenant = '${tenant1Id}'`)
    const withTenant1 = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Final%'
    `)
    console.log(`返回 ${withTenant1.length} 条记录 (预期: 1)`)
    const allTenant1 = withTenant1.every((r: any) => r.tenant_id === tenant1Id)
    if (withTenant1.length === 1 && allTenant1) {
      console.log('✓ 测试2通过: 只返回租户1的数据')
    } else {
      console.log('✗ 测试2失败: 返回了其他租户的数据')
      console.log('返回的数据:', withTenant1)
    }

    // 测试3: 设置租户2
    console.log('\n--- 测试3: 设置租户2 ---')
    await dataSource.query(`SET app.current_tenant = '${tenant2Id}'`)
    const withTenant2 = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Final%'
    `)
    console.log(`返回 ${withTenant2.length} 条记录 (预期: 1)`)
    const allTenant2 = withTenant2.every((r: any) => r.tenant_id === tenant2Id)
    if (withTenant2.length === 1 && allTenant2) {
      console.log('✓ 测试3通过: 只返回租户2的数据')
    } else {
      console.log('✗ 测试3失败: 返回了其他租户的数据')
      console.log('返回的数据:', withTenant2)
    }

    // 测试4: 管理员模式
    console.log('\n--- 测试4: 管理员模式 ---')
    await dataSource.query(`SET app.is_admin = true`)
    const adminMode = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Final%'
    `)
    console.log(`返回 ${adminMode.length} 条记录 (预期: 2)`)
    if (adminMode.length === 2) {
      console.log('✓ 测试4通过: 管理员可以看到所有数据')
    } else {
      console.log('✗ 测试4失败: 管理员模式未生效')
      console.log('返回的数据:', adminMode)
    }

    // 清理
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`RESET app.is_admin`)
    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Final%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Final%'`)

    console.log('\n=== RLS测试完成 ===')
    console.log('\n⚠️  注意: postgres用户的BYPASSRLS权限已被移除')
    console.log('如需恢复，请运行: ALTER USER postgres BYPASSRLS')
  } catch (error) {
    console.error('测试失败:', error)
  } finally {
    await dataSource.destroy()
  }
}

testRLSWithoutBypass().catch(console.error)
