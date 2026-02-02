import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function testRLS() {
  const dataSource = new DataSource(databaseConfig() as any)
  await dataSource.initialize()

  console.log('✓ 数据库连接成功')

  try {
    // 1. 检查RLS是否启用
    console.log('\n=== 检查RLS是否启用 ===')
    const rlsStatus = await dataSource.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('radar_pushes', 'organizations', 'watched_topics')
      ORDER BY tablename
    `)
    console.log('RLS状态:', rlsStatus)

    // 2. 检查RLS策略是否存在
    console.log('\n=== 检查RLS策略 ===')
    const policies = await dataSource.query(`
      SELECT schemaname, tablename, policyname, cmd, qual
      FROM pg_policies
      WHERE tablename IN ('radar_pushes', 'organizations', 'watched_topics')
      ORDER BY tablename, policyname
    `)
    console.log('RLS策略:', policies)

    // 3. 测试RLS策略是否生效
    console.log('\n=== 测试RLS策略 ===')

    // 创建测试租户和数据
    const tenant1Id = '11111111-1111-1111-1111-111111111111'
    const tenant2Id = '22222222-2222-2222-2222-222222222222'

    // 清理旧数据
    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Test%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Test%'`)

    // 创建测试租户
    await dataSource.query(`
      INSERT INTO tenants (id, name, subscription_tier, is_active)
      VALUES
        ('${tenant1Id}', 'RLS Test Tenant 1', 'basic', true),
        ('${tenant2Id}', 'RLS Test Tenant 2', 'basic', true)
      ON CONFLICT (id) DO NOTHING
    `)

    // 创建测试组织（不设置会话变量）
    await dataSource.query(`
      INSERT INTO organizations (id, name, tenant_id)
      VALUES
        (uuid_generate_v4(), 'RLS Test Org 1', '${tenant1Id}'),
        (uuid_generate_v4(), 'RLS Test Org 2', '${tenant2Id}')
    `)

    console.log('✓ 测试数据创建成功')

    // 测试1: 不设置租户，应该返回空
    console.log('\n--- 测试1: 不设置租户 ---')
    await dataSource.query(`RESET app.current_tenant`)
    const result1 = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Test%'
    `)
    console.log(`返回 ${result1.length} 条记录 (预期: 0)`)
    if (result1.length === 0) {
      console.log('✓ 测试1通过: RLS策略阻止了未设置租户的查询')
    } else {
      console.log('✗ 测试1失败: RLS策略未生效')
      console.log('返回的数据:', result1)
    }

    // 测试2: 设置租户1，应该只返回租户1的数据
    console.log('\n--- 测试2: 设置租户1 ---')
    await dataSource.query(`SET app.current_tenant = '${tenant1Id}'`)
    const result2 = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Test%'
    `)
    console.log(`返回 ${result2.length} 条记录 (预期: 1)`)
    const allTenant1 = result2.every((r: any) => r.tenant_id === tenant1Id)
    if (result2.length === 1 && allTenant1) {
      console.log('✓ 测试2通过: 只返回租户1的数据')
    } else {
      console.log('✗ 测试2失败: 返回了其他租户的数据')
      console.log('返回的数据:', result2)
    }

    // 测试3: 设置租户2，应该只返回租户2的数据
    console.log('\n--- 测试3: 设置租户2 ---')
    await dataSource.query(`SET app.current_tenant = '${tenant2Id}'`)
    const result3 = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Test%'
    `)
    console.log(`返回 ${result3.length} 条记录 (预期: 1)`)
    const allTenant2 = result3.every((r: any) => r.tenant_id === tenant2Id)
    if (result3.length === 1 && allTenant2) {
      console.log('✓ 测试3通过: 只返回租户2的数据')
    } else {
      console.log('✗ 测试3失败: 返回了其他租户的数据')
      console.log('返回的数据:', result3)
    }

    // 测试4: 设置管理员模式，应该返回所有数据
    console.log('\n--- 测试4: 管理员模式 ---')
    await dataSource.query(`SET app.is_admin = true`)
    const result4 = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Test%'
    `)
    console.log(`返回 ${result4.length} 条记录 (预期: 2)`)
    if (result4.length === 2) {
      console.log('✓ 测试4通过: 管理员可以看到所有数据')
    } else {
      console.log('✗ 测试4失败: 管理员模式未生效')
      console.log('返回的数据:', result4)
    }

    // 清理
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`RESET app.is_admin`)
    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Test%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Test%'`)

    console.log('\n=== RLS测试完成 ===')
  } catch (error) {
    console.error('测试失败:', error)
  } finally {
    await dataSource.destroy()
  }
}

testRLS().catch(console.error)
