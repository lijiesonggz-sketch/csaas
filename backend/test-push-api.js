/**
 * 测试雷达推送API
 */

const http = require('http')

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/radar/pushes?radarType=tech&status=sent&page=1&limit=20',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
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
        console.log('\n第一条推送:')
        const push = json.data[0]
        console.log(`   ID: ${push.id}`)
        console.log(`   标题: ${push.analyzedContent?.rawContent?.title || '无标题'}`)
        console.log(`   状态: ${push.status}`)
        console.log(`   优先级: ${push.priorityLevel}`)
        console.log(`   相关性: ${push.relevanceScore}`)
      } else {
        console.log('\n⚠️  没有找到推送记录')
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
