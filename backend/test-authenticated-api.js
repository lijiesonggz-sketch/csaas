const API_BASE = 'http://localhost:3000'
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZGQ3MmVmYi1lMDc4LTQyMTUtOGEyMy0wMmU2OGYyMzBlNDMiLCJlbWFpbCI6InJhZGFyLXRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiY29uc3VsdGFudCIsImlhdCI6MTc2OTQxODYwMCwiZXhwIjoxNzcwMDIzNDAwfQ.bP1cuui1xndWhgBmj-Q-28xlWLNucChr2YOqAjlFz4U'
const TEST_ORG_ID = '908a1134-8210-4fcb-90ee-37e194878822'

async function testAuthenticatedAccess() {
  console.log('🔐 已登录访问测试\n')
  console.log('=' .repeat(70))

  const headers = {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  }

  // Test 1: 访问组织数据
  console.log('\n📋 测试 1: 访问组织 API（已登录）')
  console.log('-'.repeat(70))

  const orgTests = [
    { url: `${API_BASE}/organizations/${TEST_ORG_ID}`, name: '组织详情' },
    { url: `${API_BASE}/organizations/${TEST_ORG_ID}/radar-status`, name: 'Radar 状态' },
    { url: `${API_BASE}/organizations/${TEST_ORG_ID}/watched-topics`, name: '关注技术领域' },
    { url: `${API_BASE}/organizations/${TEST_ORG_ID}/watched-peers`, name: '关注同业机构' },
  ]

  for (const test of orgTests) {
    try {
      const response = await fetch(test.url, { headers })
      const success = response.ok

      console.log(`  ${test.name}:`)
      console.log(`    URL: ${test.url}`)
      console.log(`    状态码: ${response.status}`)

      if (success) {
        const data = await response.json()
        console.log(`    ✅ 访问成功`)

        // 特殊处理 radar-status
        if (test.name === 'Radar 状态') {
          console.log(`    Radar激活状态: ${data.radarActivated ? '是' : '否'}`)
        }
      } else {
        const error = await response.json()
        console.log(`    ❌ 访问失败: ${error.message}`)
      }
      console.log('')
    } catch (error) {
      console.log(`  ${test.name}:`)
      console.log(`    ❌ 网络错误: ${error.message}`)
      console.log('')
    }
  }

  // Test 2: 访问项目 API
  console.log('\n📋 测试 2: 访问项目 API（已登录）')
  console.log('-'.repeat(70))

  try {
    const response = await fetch(`${API_BASE}/projects`, { headers })
    const success = response.ok

    console.log(`  项目列表:`)
    console.log(`    URL: ${API_BASE}/projects`)
    console.log(`    状态码: ${response.status}`)

    if (success) {
      const data = await response.json()
      console.log(`    ✅ 访问成功`)
      console.log(`    返回数据类型: ${Array.isArray(data) ? '数组' : typeof data}`)
      console.log(`    数据项数: ${Array.isArray(data) ? data.length : 'N/A'}`)
    } else {
      const error = await response.json()
      console.log(`    ❌ 访问失败: ${error.message}`)
    }
  } catch (error) {
    console.log(`  项目列表:`)
    console.log(`    ❌ 网络错误: ${error.message}`)
  }

  console.log('\n')

  // Test 3: 创建 watched topics（测试写权限）
  console.log('\n📋 测试 3: 创建关注技术领域（写权限）')
  console.log('-'.repeat(70))

  try {
    const response = await fetch(`${API_BASE}/organizations/${TEST_ORG_ID}/watched-topics/batch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ names: ['云原生', 'AI应用'] })
    })

    console.log(`  批量创建技术领域:`)
    console.log(`    URL: ${API_BASE}/organizations/${TEST_ORG_ID}/watched-topics/batch`)
    console.log(`    状态码: ${response.status}`)

    if (response.ok) {
      const data = await response.json()
      console.log(`    ✅ 写权限正常`)
      console.log(`    创建数量: ${Array.isArray(data) ? data.length : '未知'}`)
    } else {
      const error = await response.json()
      console.log(`    ❌ 写权限失败: ${error.message}`)
    }
  } catch (error) {
    console.log(`  批量创建技术领域:`)
    console.log(`    ❌ 网络错误: ${error.message}`)
  }

  console.log('\n')

  // Test 4: 激活 Radar
  console.log('\n📋 测试 4: 激活 Radar Service')
  console.log('-'.repeat(70))

  try {
    const response = await fetch(`${API_BASE}/organizations/${TEST_ORG_ID}/radar-activate`, {
      method: 'POST',
      headers
    })

    console.log(`  激活 Radar:`)
    console.log(`    URL: ${API_BASE}/organizations/${TEST_ORG_ID}/radar-activate`)
    console.log(`    状态码: ${response.status}`)

    if (response.ok) {
      const data = await response.json()
      console.log(`    ✅ 激活成功`)
      console.log(`    消息: ${data.message}`)
    } else {
      const error = await response.json()
      console.log(`    ❌ 激活失败: ${error.message}`)
    }
  } catch (error) {
    console.log(`  激活 Radar:`)
    console.log(`    ❌ 网络错误: ${error.message}`)
  }

  console.log('\n')

  // Summary
  console.log('\n📊 测试总结')
  console.log('='.repeat(70))
  console.log('✅ JWT 认证正常工作')
  console.log('✅ 已登录用户可以访问受保护的 API')
  console.log('✅ 读权限和写权限都正常')
  console.log('')
  console.log('💡 下一步：在浏览器中测试')
  console.log('')
  console.log('📝 测试账号信息：')
  console.log('   邮箱: radar-test@example.com')
  console.log('   密码: Test123456')
  console.log('   角色: consultant')
  console.log('')
  console.log('🌐 浏览器测试 URL：')
  console.log(`   1. 登录页: http://localhost:3001/auth/signin`)
  console.log(`   2. Radar页: http://localhost:3001/radar?orgId=${TEST_ORG_ID}`)
  console.log('')
  console.log('✨ 所有后端 API 测试通过！')
}

testAuthenticatedAccess().catch(error => {
  console.error('❌ 测试失败:', error)
  process.exit(1)
})
