import { DataSource } from 'typeorm'
import { databaseConfig } from './src/config/database.config'

async function testRLSWithConnection() {
  const dataSource = new DataSource(databaseConfig() as any)
  await dataSource.initialize()

  console.log('✓ 数据库连接成功')

  try {
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

    // 创建测试组织
    await dataSource.query(`
      INSERT INTO organizations (id, name, tenant_id)
      VALUES
        (uuid_generate_v4(), 'RLS Test Org 1', '${tenant1Id}'),
        (uuid_generate_v4(), 'RLS Test Org 2', '${tenant2Id}')
    `)

    console.log('✓ 测试数据创建成功\n')

    // ===== 测试1: 检查会话变量是否持久化 =====
    console.log('=== 测试1: 会话变量持久化 ===')

    // 设置会话变量
    await dataSource.query(`SET app.current_tenant = '${tenant1Id}'`)
    console.log('✓ 设置 app.current_tenant')

    // 立即读取
    const result1 = await dataSource.query(`SELECT current_setting('app.current_tenant', true) as tenant`)
    console.log('立即读取:', result1[0]?.tenant || '(空)')

    // 执行一个查询后再读取
    await dataSource.query(`SELECT 1`)
    const result2 = await dataSource.query(`SELECT current_setting('app.current_tenant', true) as tenant`)
    console.log('查询后读取:', result2[0]?.tenant || '(空)')

    // 使用Repository查询后再读取
    const orgRepo = dataSource.getRepository('Organization')
    await orgRepo.find()
    const result3 = await dataSource.query(`SELECT current_setting('app.current_tenant', true) as tenant`)
    console.log('Repository查询后读取:', result3[0]?.tenant || '(空)')

    // ===== 测试2: 使用单个连接测试RLS =====
    console.log('\n=== 测试2: 单连接RLS测试 ===')

    const queryRunner = dataSource.createQueryRunner()
    await queryRunner.connect()

    try {
      // 在同一个连接中设置和查询
      await queryRunner.query(`SET app.current_tenant = '${tenant1Id}'`)
      console.log('✓ 在QueryRunner中设置 app.current_tenant')

      // 验证设置
      const check = await queryRunner.query(`SELECT current_setting('app.current_tenant', true) as tenant`)
      console.log('验证设置:', check[0]?.tenant || '(空)')

      // 查询数据
      const orgs = await queryRunner.query(`
        SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Test%'
      `)
      console.log(`返回 ${orgs.length} 条记录 (预期: 1)`)

      if (orgs.length === 1 && orgs[0].tenant_id === tenant1Id) {
        console.log('✓ 测试2通过: 单连接中RLS策略生效')
      } else {
        console.log('✗ 测试2失败: RLS策略未生效')
        console.log('返回的数据:', orgs)
      }
    } finally {
      await queryRunner.release()
    }

    // ===== 测试3: 使用事务测试RLS =====
    console.log('\n=== 测试3: 事务中RLS测试 ===')

    const queryRunner2 = dataSource.createQueryRunner()
    await queryRunner2.connect()
    await queryRunner2.startTransaction()

    try {
      // 在事务中设置和查询
      await queryRunner2.query(`SET LOCAL app.current_tenant = '${tenant1Id}'`)
      console.log('✓ 在事务中设置 app.current_tenant (LOCAL)')

      // 验证设置
      const check = await queryRunner2.query(`SELECT current_setting('app.current_tenant', true) as tenant`)
      console.log('验证设置:', check[0]?.tenant || '(空)')

      // 查询数据
      const orgs = await queryRunner2.query(`
        SELECT id, name, tenant_id FROM organizations WHERE name LIKE 'RLS Test%'
      `)
      console.log(`返回 ${orgs.length} 条记录 (预期: 1)`)

      if (orgs.length === 1 && orgs[0].tenant_id === tenant1Id) {
        console.log('✓ 测试3通过: 事务中RLS策略生效')
      } else {
        console.log('✗ 测试3失败: RLS策略未生效')
        console.log('返回的数据:', orgs)
      }

      await queryRunner2.commitTransaction()
    } catch (error) {
      await queryRunner2.rollbackTransaction()
      throw error
    } finally {
      await queryRunner2.release()
    }

    // ===== 测试4: 检查RLS策略定义 =====
    console.log('\n=== 测试4: RLS策略定义 ===')

    const policies = await dataSource.query(`
      SELECT schemaname, tablename, policyname, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'organizations'
      ORDER BY policyname
    `)
    console.log('Organizations表的RLS策略:')
    policies.forEach((p: any) => {
      console.log(`  - ${p.policyname}: ${p.cmd}`)
      console.log(`    USING: ${p.qual}`)
      if (p.with_check) {
        console.log(`    WITH CHECK: ${p.with_check}`)
      }
    })

    // ===== 测试5: 手动测试RLS策略 =====
    console.log('\n=== 测试5: 手动测试RLS策略 ===')

    // 不设置租户
    await dataSource.query(`RESET app.current_tenant`)
    const noTenant = await dataSource.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Test%'
    `)
    console.log(`不设置租户: ${noTenant[0].count} 条记录 (预期: 0)`)

    // 设置租户1
    await dataSource.query(`SET app.current_tenant = '${tenant1Id}'`)
    const withTenant1 = await dataSource.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Test%'
    `)
    console.log(`设置租户1: ${withTenant1[0].count} 条记录 (预期: 1)`)

    // 设置租户2
    await dataSource.query(`SET app.current_tenant = '${tenant2Id}'`)
    const withTenant2 = await dataSource.query(`
      SELECT COUNT(*) as count FROM organizations WHERE name LIKE 'RLS Test%'
    `)
    console.log(`设置租户2: ${withTenant2[0].count} 条记录 (预期: 1)`)

    // 清理
    await dataSource.query(`RESET app.current_tenant`)
    await dataSource.query(`DELETE FROM organizations WHERE name LIKE 'RLS Test%'`)
    await dataSource.query(`DELETE FROM tenants WHERE name LIKE 'RLS Test%'`)

    console.log('\n=== RLS连接测试完成 ===')
  } catch (error) {
    console.error('测试失败:', error)
  } finally {
    await dataSource.destroy()
  }
}

testRLSWithConnection().catch(console.error)
