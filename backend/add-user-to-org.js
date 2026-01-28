const { Client } = require('pg')

async function addUserToOrganization() {
  const userId = 'ddd72efb-e078-4215-8a23-02e68f230e43'
  const orgId = '908a1134-8210-4fcb-90ee-37e194878822'

  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas',
  })

  try {
    await client.connect()
    console.log('✅ 数据库连接成功\n')

    // Check if user is already a member
    const checkResult = await client.query(
      'SELECT * FROM "organization_members" WHERE "organization_id" = $1 AND "user_id" = $2',
      [orgId, userId]
    )

    if (checkResult.rows.length > 0) {
      console.log('ℹ️  用户已经是该组织成员')
      console.log(`   角色: ${checkResult.rows[0].role}`)
      await client.end()
      return
    }

    // Add user to organization as admin
    const result = await client.query(
      `INSERT INTO "organization_members" ("organization_id", "user_id", "role", "created_at")
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [orgId, userId, 'admin']
    )

    console.log('✅ 成功将用户添加到组织')
    console.log(`   组织ID: ${orgId}`)
    console.log(`   用户ID: ${userId}`)
    console.log(`   角色: admin`)
    console.log(`   成员ID: ${result.rows[0].id}`)

    await client.end()

    console.log('\n🎯 现在可以在浏览器中测试了！')
    console.log('\n📝 测试账号：')
    console.log('   邮箱: radar-test@example.com')
    console.log('   密码: Test123456')
    console.log('\n🌐 浏览器测试步骤：')
    console.log('   1. 打开: http://localhost:3001/auth/signin')
    console.log('   2. 使用上面的邮箱和密码登录')
    console.log(`   3. 登录后访问: http://localhost:3001/radar?orgId=${orgId}`)
    console.log('\n✨ 预期结果：')
    console.log('   - 页面正常加载')
    console.log('   - 显示三个雷达卡片')
    console.log('   - 显示 "✓ Radar已激活" 徽章')
    console.log('   - 不会弹出引导向导')

  } catch (error) {
    console.error('❌ 错误:', error.message)
    await client.end()
    process.exit(1)
  }
}

addUserToOrganization()
