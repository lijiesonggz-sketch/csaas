const { Client } = require('pg')
require('dotenv').config({ path: '.env.development' })

async function createTestOrganization() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'csaas',
  })

  try {
    await client.connect()

    // Check if organization already exists
    const checkResult = await client.query(
      'SELECT id, name, radar_activated FROM organizations WHERE name = $1',
      ['CSAAS公司']
    )

    if (checkResult.rows.length > 0) {
      const org = checkResult.rows[0]
      console.log('✅ 组织已存在:', {
        id: org.id,
        name: org.name,
        radarActivated: org.radar_activated,
      })
      await client.end()
      return org.id
    }

    // Create new organization
    const result = await client.query(
      `INSERT INTO organizations (name, radar_activated, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, name, radar_activated`,
      ['CSAAS公司', false]
    )

    const org = result.rows[0]
    console.log('✅ 成功创建测试组织:', {
      id: org.id,
      name: org.name,
      radarActivated: org.radar_activated,
    })

    await client.end()
    return org.id
  } catch (error) {
    console.error('❌ 创建组织失败:', error.message)
    await client.end()
    process.exit(1)
  }
}

createTestOrganization()
  .then((id) => {
    console.log('\n📝 使用以下 URL 访问 Radar 页面:')
    console.log(`http://localhost:3001/radar?orgId=${id}`)
    console.log('\n🎯 开始自动验证...')
    return id
  })
  .then(async (orgId) => {
    // Wait a bit for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Test radar status endpoint
    console.log('\n📡 测试 API 端点...')

    const radarStatusUrl = `http://localhost:3000/organizations/${orgId}/radar-status`
    console.log(`  GET ${radarStatusUrl}`)

    const response = await fetch(radarStatusUrl)
    const data = await response.json()

    console.log(`  状态码: ${response.status}`)
    console.log(`  响应:`, JSON.stringify(data, null, 2))

    if (response.ok && data.radarActivated === false) {
      console.log('  ✅ Radar 状态查询成功')
    } else {
      console.log('  ❌ Radar 状态查询失败')
    }

    console.log('\n✨ 自动验证完成！')
    console.log(`\n💡 请在浏览器中打开: http://localhost:3001/radar?orgId=${orgId}`)
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error.message)
    process.exit(1)
  })
