/**
 * 测试雷达推送API（使用你的token）
 */

const http = require('http')

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjOWM2MmI5Mi05NWU3LTQ1ZDQtOTdmMS1mMDYwM2ViMjQyZGMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiY29uc3VsdGFudCIsImlhdCI6MTc2OTYwMzY4NywiZXhwIjoxNzcwMjA4NDg3fQ.JIKD0Prbl9wJmM8yJ0TlUvMpmdONaVP9zo6bFj0rYMo'

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/radar/pushes?radarType=tech&status=sent&page=1&limit=20',
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
    console.log('📡 API响应状态:', res.statusCode)
    console.log('📦 响应数据:\n')

    try {
      const json = JSON.parse(data)
      console.log(JSON.stringify(json, null, 2))

      if (json.data && json.data.length > 0) {
        console.log(`\n✅ 找到 ${json.data.length} 条推送记录`)
      } else {
        console.log('\n⚠️  没有找到推送记录')
        console.log('\n💡 可能的原因:')
        console.log('   1. 推送记录的状态不是 sent')
        console.log('   2. 用户没有权限查看这些推送')
        console.log('   3. 推送的组织ID与用户不匹配')
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
