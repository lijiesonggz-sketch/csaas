/**
 * 测试聚类API是否能正常响应
 */

async function testClusteringAPI() {
  // 生成有效的UUID
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  const testData = {
    taskId: generateUUID(),
    projectId: null, // 测试时不需要project ID
    documents: [
      {
        id: 'doc_1',
        name: '测试文档1',
        content: '这是一个测试文档，内容很短。'.repeat(100), // 约2000字符
      },
      {
        id: 'doc_2',
        name: '测试文档2',
        content: '这是另一个测试文档。'.repeat(100), // 约2000字符
      },
    ],
    temperature: 0.7,
    maxTokens: 60000,
  }

  console.log('发送测试请求...')
  console.log('请求体大小:', JSON.stringify(testData).length, '字节')

  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1200000) // 20分钟超时

    const response = await fetch('http://localhost:3000/ai-generation/clustering', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const elapsed = Date.now() - startTime
    console.log('响应时间:', (elapsed / 1000).toFixed(1), '秒')
    console.log('响应状态:', response.status, response.statusText)
    console.log('响应头:', Object.fromEntries(response.headers.entries()))

    const data = await response.json()
    console.log('响应数据:', JSON.stringify(data, null, 2).substring(0, 500) + '...')

    if (data.success) {
      console.log('✅ 测试成功！任务ID:', data.taskId)
    } else {
      console.log('❌ 测试失败:', data.error)
    }
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error('❌ 请求失败 (用时', (elapsed / 1000).toFixed(1), '秒):', error.message)
    if (error.name === 'AbortError') {
      console.error('请求超时')
    }
  }
}

testClusteringAPI()
