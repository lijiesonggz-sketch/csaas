import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function debugRLSPolicy() {
  const dataSource = new DataSource(databaseConfig() as any)
  await dataSource.initialize()

  console.log('=== 调试RLS策略 ===\n')

  try {
    const tenant1Id = '11111111-1111-1111-1111-111111111111'

    // 1. 测试current_setting函数
    console.log('1. 测试current_setting函数:')

    // 不设置
    await dataSource.query(`RESET app.current_tenant`)
    const test1 = await dataSource.query(`SELECT current_setting('app.current_tenant', true) as value`)
    console.log('未设置时:', test1[0].value || '(空字符串)')

    // 设置后
    await dataSource.query(`SET app.current_tenant = '${tenant1Id}'`)
    const test2 = await dataSource.query(`SELECT current_setting('app.current_tenant', true) as value`)
    console.log('设置后:', test2[0].value)

    // 2. 测试UUID转换
    console.log('\n2. 测试UUID转换:')
    const test3 = await dataSource.query(`
      SELECT
        current_setting('app.current_tenant', true) as str_value,
        current_setting('app.current_tenant', true)::uuid as uuid_value
    `)
    console.log('字符串值:', test3[0].str_value)
    console.log('UUID值:', test3[0].uuid_value)

    // 3. 测试策略条件
    console.log('\n3. 测试策略条件:')

    // 创建测试数据
    await dataSource.query(`DELETE FROM organizations WHERE name = 'Debug Org'`)
    await dataSource.query(`DELETE FROM tenants WHERE name = 'Debug Tenant'`)

    await dataSource.query(`
      INSERT INTO tenants (id, name, subscription_tier, is_active)
      VALUES ('${tenant1Id}', 'Debug Tenant', 'basic', true)
      ON CONFLICT (id) DO NOTHING
    `)

    const orgResult = await dataSource.query(`
      INSERT INTO organizations (id, name, tenant_id)
      VALUES (uuid_generate_v4(), 'Debug Org', '${tenant1Id}')
      RETURNING id, tenant_id
    `)
    const orgId = orgResult[0].id
    const orgTenantId = orgResult[0].tenant_id

    console.log('创建的组织:')
    console.log('  ID:', orgId)
    console.log('  tenant_id:', orgTenantId)

    // 4. 手动测试策略条件
    console.log('\n4. 手动测试策略条件:')
    const test4 = await dataSource.query(`
      SELECT
        id,
        tenant_id,
        tenant_id = current_setting('app.current_tenant', true)::uuid as condition_result
      FROM organizations
      WHERE name = 'Debug Org'
    `)
    console.log('策略条件评估:', test4)

    // 5. 测试策略是否应用
    console.log('\n5. 测试策略是否应用:')

    // 设置不同的租户
    const tenant2Id = '22222222-2222-2222-2222-222222222222'
    await dataSource.query(`SET app.current_tenant = '${tenant2Id}'`)

    const test5 = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name = 'Debug Org'
    `)
    console.log(`设置为tenant2时查询结果: ${test5.length} 条 (预期: 0)`)
    if (test5.length > 0) {
      console.log('返回的数据:', test5)
      console.log('⚠️  策略未生效！')
    }

    // 设置正确的租户
    await dataSource.query(`SET app.current_tenant = '${tenant1Id}'`)
    const test6 = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name = 'Debug Org'
    `)
    console.log(`设置为tenant1时查询结果: ${test6.length} 条 (预期: 1)`)
    if (test6.length === 1) {
      console.log('返回的数据:', test6[0])
    }

    // 6. 检查策略是否真的启用
    console.log('\n6. 检查策略启用状态:')
    const policyStatus = await dataSource.query(`
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd
      FROM pg_policies
      WHERE tablename = 'organizations'
    `)
    console.log('策略状态:', JSON.stringify(policyStatus, null, 2))

    // 7. 检查是否有其他策略冲突
    console.log('\n7. 检查所有策略:')
    const allPolicies = await dataSource.query(`
      SELECT COUNT(*) as count
      FROM pg_policies
      WHERE tablename = 'organizations'
    `)
    console.log(`Organizations表共有 ${allPolicies[0].count} 个策略`)

    // 清理
    await dataSource.query(`DELETE FROM organizations WHERE name = 'Debug Org'`)
    await dataSource.query(`DELETE FROM tenants WHERE name = 'Debug Tenant'`)

    console.log('\n=== 调试完成 ===')
  } catch (error) {
    console.error('失败:', error)
  } finally {
    await dataSource.destroy()
  }
}

debugRLSPolicy().catch(console.error)
