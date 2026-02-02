import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function testRLSForceMode() {
  const dataSource = new DataSource(databaseConfig() as any)
  await dataSource.initialize()

  console.log('=== 测试RLS FORCE模式 ===\n')

  try {
    // 1. 检查当前用户和表所有者
    console.log('1. 检查用户和所有者:')
    const currentUser = await dataSource.query(`SELECT current_user`)
    const tableOwner = await dataSource.query(`
      SELECT tableowner FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'organizations'
    `)
    console.log('当前用户:', currentUser[0].current_user)
    console.log('表所有者:', tableOwner[0].tableowner)

    if (currentUser[0].current_user === tableOwner[0].tableowner) {
      console.log('⚠️  当前用户是表所有者，RLS策略默认不生效！')
      console.log('解决方案: 使用 ALTER TABLE ... FORCE ROW LEVEL SECURITY')
    }

    // 2. 启用FORCE RLS
    console.log('\n2. 启用FORCE RLS:')
    await dataSource.query(`ALTER TABLE organizations FORCE ROW LEVEL SECURITY`)
    console.log('✓ 已启用FORCE ROW LEVEL SECURITY')

    // 3. 验证FORCE RLS状态
    const rlsStatus = await dataSource.query(`
      SELECT
        relname,
        relrowsecurity as rls_enabled,
        relforcerowsecurity as force_rls
      FROM pg_class
      WHERE relname = 'organizations'
    `)
    console.log('RLS状态:', rlsStatus)

    // 4. 测试策略
    console.log('\n3. 测试策略:')

    const tenant1Id = '11111111-1111-1111-1111-111111111111'
    const tenant2Id = '22222222-2222-2222-2222-222222222222'

    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Force%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Force%'`)

    await dataSource.query(`
      INSERT INTO tenants (id, name, subscription_tier, is_active)
      VALUES
        ('${tenant1Id}', 'RLS Force Tenant 1', 'basic', true),
        ('${tenant2Id}', 'RLS Force Tenant 2', 'basic', true)
      ON CONFLICT (id) DO NOTHING
    `)

    await dataSource.query(`
      INSERT INTO organizations (id, name, tenant_id)
      VALUES
        (uuid_generate_v4(), 'RLS Force Org 1', '${tenant1Id}'),
        (uuid_generate_v4(), 'RLS Force Org 2', '${tenant2Id}')
    `)

    // 测试1: 不设置租户
    console.log('\n--- 测试1: 不设置租户 ---')
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`RESET app.is_admin`)
    const noTenant = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Force%'
    `)
    console.log(`返回 ${noTenant.length} 条记录 (预期: 0)`)
    if (noTenant.length === 0) {
      console.log('✓ 测试1通过: RLS策略阻止了未设置租户的查询')
    } else {
      console.log('✗ 测试1失败')
      console.log('返回的数据:', noTenant)
    }

    // 测试2: 设置租户1
    console.log('\n--- 测试2: 设置租户1 ---')
    await dataSource.query(`SET app.current_tenant = '${tenant1Id}'`)
    const withTenant1 = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Force%'
    `)
    console.log(`返回 ${withTenant1.length} 条记录 (预期: 1)`)
    const allTenant1 = withTenant1.every((r: any) => r.tenant_id === tenant1Id)
    if (withTenant1.length === 1 && allTenant1) {
      console.log('✓ 测试2通过: 只返回租户1的数据')
      console.log('返回的数据:', withTenant1[0])
    } else {
      console.log('✗ 测试2失败')
      console.log('返回的数据:', withTenant1)
    }

    // 测试3: 设置租户2
    console.log('\n--- 测试3: 设置租户2 ---')
    await dataSource.query(`SET app.current_tenant = '${tenant2Id}'`)
    const withTenant2 = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Force%'
    `)
    console.log(`返回 ${withTenant2.length} 条记录 (预期: 1)`)
    const allTenant2 = withTenant2.every((r: any) => r.tenant_id === tenant2Id)
    if (withTenant2.length === 1 && allTenant2) {
      console.log('✓ 测试3通过: 只返回租户2的数据')
      console.log('返回的数据:', withTenant2[0])
    } else {
      console.log('✗ 测试3失败')
      console.log('返回的数据:', withTenant2)
    }

    // 测试4: 管理员模式
    console.log('\n--- 测试4: 管理员模式 ---')
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`SET app.is_admin = true`)
    const adminMode = await dataSource.query(`
      SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Force%'
    `)
    console.log(`返回 ${adminMode.length} 条记录 (预期: 2)`)
    if (adminMode.length === 2) {
      console.log('✓ 测试4通过: 管理员可以看到所有数据')
    } else {
      console.log('✗ 测试4失败')
      console.log('返回的数据:', adminMode)
    }

    // 清理
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`RESET app.is_admin`)
    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Force%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Force%'`)

    console.log('\n=== 测试完成 ===')
    console.log('\n✅ 如果测试通过，需要对所有表启用FORCE RLS')
  } catch (error) {
    console.error('失败:', error)
  } finally {
    await dataSource.destroy()
  }
}

testRLSForceMode().catch(console.error)
