/**
 * 检查用户的组织
 */

const http = require('http')

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjOWM2MmI5Mi05NWU3LTQ1ZDQtOTdmMS1mMDYwM2ViMjQyZGMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiY29uc3VsdGFudCIsImlhdCI6MTc2OTYwMzY4NywiZXhwIjoxNzcwMjA4NDg3fQ.JIKD0Prbl9wJmM8yJ0TlUvMpmdONaVP9zo6bFj0rYMo'

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/organizations/me',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

const req = http.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    console.log('📡 /organizations/me 响应状态:', res.statusCode)
    console.log('📦 响应数据:\n')

    try {
      const json = JSON.parse(data)
      console.log(JSON.stringify(json, null, 2))

      if (Array.isArray(json) && json.length > 0) {
        console.log(`\n✅ 找到 ${json.length} 个组织:`)
        json.forEach((org, i) => {
          console.log(`   ${i+1}. ${org.name} (ID: ${org.id})`)
        })
      } else if (json.message) {
        console.log('\n⚠️  错误:', json.message)
      }
    } catch (error) {
      console.log('解析JSON失败:', error.message)
      console.log('原始响应:', data)
    }
  })
})

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message)
})

req.end()
