const { Client } = require('pg')

async function createAndVerify() {
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

    // Check if CSAAS company already exists
    const checkResult = await client.query(
      'SELECT id, name, radar_activated FROM organizations WHERE name = $1',
      ['CSAAS公司']
    )

    let orgId
    if (checkResult.rows.length > 0) {
      const org = checkResult.rows[0]
      console.log('✅ 组织已存在:')
      console.log(`   ID: ${org.id}`)
      console.log(`   名称: ${org.name}`)
      console.log(`   Radar已激活: ${org.radar_activated ? '是' : '否'}\n`)
      orgId = org.id
    } else {
      // Create CSAAS company
      const result = await client.query(
        `INSERT INTO organizations (name, radar_activated, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         RETURNING id, name, radar_activated`,
        ['CSAAS公司', false]
      )

      const org = result.rows[0]
      console.log('✅ 成功创建测试组织:')
      console.log(`   ID: ${org.id}`)
      console.log(`   名称: ${org.name}`)
      console.log(`   Radar已激活: ${org.radar_activated ? '是' : '否'}\n`)
      orgId = org.id
    }

    await client.end()

    // Start automated verification
    console.log('🎯 开始自动验证 Radar 功能...\n')

    const baseUrl = `http://localhost:3000/organizations/${orgId}`

    // Test 1: Get radar status
    console.log('📡 测试 1: 获取 Radar 状态')
    console.log(`   GET ${baseUrl}/radar-status`)
    const statusRes = await fetch(`${baseUrl}/radar-status`)
    const statusData = await statusRes.json()
    console.log(`   状态码: ${statusRes.status}`)
    console.log(`   响应:`, JSON.stringify(statusData, null, 2))
    console.log(statusRes.ok && statusData.radarActivated === false ? '   ✅ 通过\n' : '   ❌ 失败\n')

    // Test 2: Create watched topics
    console.log('📡 测试 2: 创建关注技术领域')
    console.log(`   POST ${baseUrl}/watched-topics/batch`)
    const topicsRes = await fetch(`${baseUrl}/watched-topics/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: ['云原生', 'AI应用', '移动金融安全'] }),
    })
    const topicsData = await topicsRes.json()
    console.log(`   状态码: ${topicsRes.status}`)
    console.log(`   响应:`, JSON.stringify(topicsData, null, 2))
    if (Array.isArray(topicsData) && topicsData.length > 0) {
      console.log(`   创建了 ${topicsData.length} 个技术领域`)
      topicsData.forEach(topic => console.log(`   - ${topic.name}`))
    }
    console.log(topicsRes.ok ? '   ✅ 通过\n' : '   ❌ 失败\n')

    // Test 3: Create watched peers
    console.log('📡 测试 3: 创建关注同业机构')
    console.log(`   POST ${baseUrl}/watched-peers/batch`)
    const peersRes = await fetch(`${baseUrl}/watched-peers/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: ['招商银行', '杭州银行', '宁波银行'] }),
    })
    const peersData = await peersRes.json()
    console.log(`   状态码: ${peersRes.status}`)
    console.log(`   创建了 ${peersData.length} 个同业机构`)
    peersData.forEach(peer => console.log(`   - ${peer.name}`))
    console.log(peersRes.ok ? '   ✅ 通过\n' : '   ❌ 失败\n')

    // Test 4: Activate radar service
    console.log('📡 测试 4: 激活 Radar Service')
    console.log(`   POST ${baseUrl}/radar-activate`)
    const activateRes = await fetch(`${baseUrl}/radar-activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const activateData = await activateRes.json()
    console.log(`   状态码: ${activateRes.status}`)
    console.log(`   响应:`, JSON.stringify(activateData, null, 2))
    console.log(activateRes.ok ? '   ✅ 通过\n' : '   ❌ 失败\n')

    // Test 5: Verify radar is activated
    console.log('📡 测试 5: 验证 Radar 已激活')
    console.log(`   GET ${baseUrl}/radar-status`)
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait for DB update
    const verifyRes = await fetch(`${baseUrl}/radar-status`)
    const verifyData = await verifyRes.json()
    console.log(`   状态码: ${verifyRes.status}`)
    console.log(`   响应:`, JSON.stringify(verifyData, null, 2))
    console.log(verifyRes.ok && verifyData.radarActivated === true ? '   ✅ 通过\n' : '   ❌ 失败\n')

    // Test 6: Get watched topics
    console.log('📡 测试 6: 获取关注技术领域')
    console.log(`   GET ${baseUrl}/watched-topics`)
    const getTopicsRes = await fetch(`${baseUrl}/watched-topics`)
    const getTopicsData = await getTopicsRes.json()
    console.log(`   状态码: ${getTopicsRes.status}`)
    console.log(`   响应:`, JSON.stringify(getTopicsData, null, 2))
    if (Array.isArray(getTopicsData) && getTopicsData.length > 0) {
      console.log(`   找到 ${getTopicsData.length} 个技术领域`)
      getTopicsData.forEach(topic => console.log(`   - ${topic.name}`))
    }
    console.log(getTopicsRes.ok ? '   ✅ 通过\n' : '   ❌ 失败\n')

    // Test 7: Get watched peers
    console.log('📡 测试 7: 获取关注同业机构')
    console.log(`   GET ${baseUrl}/watched-peers`)
    const getPeersRes = await fetch(`${baseUrl}/watched-peers`)
    const getPeersData = await getPeersRes.json()
    console.log(`   状态码: ${getPeersRes.status}`)
    console.log(`   响应:`, JSON.stringify(getPeersData, null, 2))
    if (Array.isArray(getPeersData) && getPeersData.length > 0) {
      console.log(`   找到 ${getPeersData.length} 个同业机构`)
      getPeersData.forEach(peer => console.log(`   - ${peer.name}`))
    }
    console.log(getPeersRes.ok ? '   ✅ 通过\n' : '   ❌ 失败\n')

    console.log('✨ 所有测试完成！\n')
    console.log('📝 在浏览器中打开以下 URL 进行手动测试:')
    console.log(`   http://localhost:3001/radar?orgId=${orgId}\n`)
    console.log('💡 你应该能看到:')
    console.log('   1. 三个雷达卡片（技术雷达、行业雷达、合规雷达）')
    console.log('   2. "✓ Radar已激活" 徽章')
    console.log('   3. 引导向导不会再次出现')

    process.exit(0)
  } catch (error) {
    console.error('❌ 错误:', error.message)
    try {
      await client.end()
    } catch (e) {
      // Ignore
    }
    process.exit(1)
  }
}

createAndVerify()
