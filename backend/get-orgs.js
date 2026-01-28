const { Client } = require('pg')

async function getExistingOrganizations() {
  // Try different connection methods
  const connectionConfigs = [
    {
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'postgres',
      database: 'csaas',
    },
    {
      host: 'localhost',
      port: 5432,
      user: '27937',
      database: 'csaas',
    },
  ]

  for (const config of connectionConfigs) {
    const client = new Client(config)

    try {
      await client.connect()
      console.log(`✅ 使用配置连接成功:`, { user: config.user })

      const result = await client.query(
        'SELECT id, name, radar_activated FROM organizations ORDER BY created_at DESC LIMIT 5'
      )

      console.log(`\n📋 找到 ${result.rows.length} 个组织:\n`)

      result.rows.forEach((org, index) => {
        console.log(`${index + 1}. ID: ${org.id}`)
        console.log(`   名称: ${org.name}`)
        console.log(`   Radar已激活: ${org.radar_activated ? '是' : '否'}`)
        console.log(`   URL: http://localhost:3001/radar?orgId=${org.id}`)
        console.log('')
      })

      if (result.rows.length > 0) {
        const firstOrg = result.rows[0]
        console.log(`\n💡 推荐使用第一个组织进行测试:`)
        console.log(`   http://localhost:3001/radar?orgId=${firstOrg.id}`)

        await client.end()
        return firstOrg.id
      }

      await client.end()
      return null
    } catch (error) {
      console.log(`❌ 连接失败 (user: ${config.user}):`, error.message)
      try {
        await client.end()
      } catch (e) {
        // Ignore
      }
    }
  }

  console.log('\n❌ 所有连接方式都失败了')
  console.log('\n💡 建议: 请手动在数据库中创建组织，或者使用现有组织 ID')
  process.exit(1)
}

getExistingOrganizations()
  .then((orgId) => {
    if (orgId) {
      console.log('\n🎯 开始自动验证...')

      // Test API endpoint
      return fetch(`http://localhost:3000/organizations/${orgId}/radar-status`)
        .then(response => response.json())
        .then(data => {
          console.log('\n📡 Radar 状态查询结果:')
          console.log(JSON.stringify(data, null, 2))
          console.log('\n✨ 准备就绪！请在浏览器中打开上面的 URL')
        })
    }
  })
  .catch(error => {
    console.error('Error:', error.message)
    process.exit(1)
  })
