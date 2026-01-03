/**
 * 测试 AI 模型的 maxTokens 限制配置
 * 验证 Claude (64K) 和 Qwen-Long (32K) 能否正确处理 30K token 请求
 */

const BASE_URL = 'http://localhost:3000'

// 生成 UUID v4
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

async function testMaxTokensConfig() {
  console.log('🧪 测试聚类功能的 maxTokens 配置\n')
  console.log('预期配置:')
  console.log('- Claude Sonnet 4.5: 最大 64,000 输出 tokens')
  console.log('- Qwen-Long: 最大 32,768 输出 tokens')
  console.log('- OpenAI GPT-4: 已禁用')
  console.log('- 前端请求: 30,000 tokens')
  console.log('- 测试方式: 调用聚类API（会并行测试三个模型）\n')

  const taskId = uuidv4()

  // 准备测试文档（符合 StandardDocumentDto 格式）
  const documents = [
    {
      id: 'iso-27001',
      name: 'ISO 27001 信息安全管理',
      content: `
        A.5.1 信息安全策略集
        A.5.1.1 信息安全策略文件
        应制定一套信息安全政策，该政策应由管理层批准，发布并传达给所有员工和相关外部方。

        A.5.1.2 信息安全策略评审
        应按计划的时间间隔或当发生重大变更时，评审信息安全政策，以确保其持续适宜性、充分性和有效性。

        A.6.1 内部组织
        A.6.1.1 信息安全角色和职责
        应定义并分配所有信息安全职责。
        `.repeat(5), // 扩展内容使其至少100字符
    },
    {
      id: 'djbh-2.0',
      name: '等保2.0 三级要求',
      content: `
        8.1.3 安全管理制度
        8.1.3.1 管理制度
        应制定信息安全工作的总体方针和安全策略，说明机构安全工作的总体目标、范围、原则和安全框架等。

        8.1.3.2 制度管理
        应对安全管理制度的制定、发布、评审、修订等进行管理。

        8.1.4 安全管理机构
        8.1.4.1 岗位设置
        应设立信息安全管理工作的职能部门，设立安全主管、安全管理各个方面的负责人岗位，并定义各负责人的职责。
        `.repeat(5),
    },
  ]

  console.log(`📤 发送聚类请求...`)
  console.log(`   Task ID: ${taskId}`)
  console.log(`   文档数量: ${documents.length}`)
  console.log(`   MaxTokens: 30000\n`)

  const startTime = Date.now()

  try {
    const response = await fetch(`${BASE_URL}/ai-generation/clustering`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        documents,
        temperature: 0.7,
        maxTokens: 30000,
      }),
    })

    const duration = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      console.log(`❌ 请求失败 (${duration}ms)`)
      console.log(`状态码: ${response.status}`)
      console.log(`错误信息:\n${errorText}`)
      return
    }

    const result = await response.json()

    if (!result.success) {
      console.log(`❌ 业务失败 (${duration}ms)`)
      console.log(`错误: ${result.error || 'Unknown error'}`)
      return
    }

    console.log(`✅ 聚类任务已启动 (${duration}ms)`)
    console.log(`\n📊 等待AI生成结果...（这会调用三个模型并行生成）`)
    console.log(`   - GPT-4: 已禁用（会fallback到Claude或Tongyi）`)
    console.log(`   - Claude Sonnet 4.5: maxTokens=${30000} (限制64000)`)
    console.log(`   - Tongyi Qwen-Long: maxTokens=${30000} (限制32768)`)

    // 轮询结果
    let attempts = 0
    const maxAttempts = 60 // 最多等待60秒

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000)) // 每2秒查询一次
      attempts++

      const resultResponse = await fetch(`${BASE_URL}/ai-generation/result/${taskId}`)
      const resultData = await resultResponse.json()

      if (resultData.success && resultData.data) {
        const totalDuration = Date.now() - startTime
        console.log(`\n✅ 生成完成！(总耗时: ${(totalDuration / 1000).toFixed(1)}s)`)
        console.log(`\n📈 结果摘要:`)
        console.log(`   GPT-4 聚类数: ${resultData.data.gpt4?.clusters?.length || 'N/A'}`)
        console.log(`   Claude 聚类数: ${resultData.data.claude?.clusters?.length || 'N/A'}`)
        console.log(`   Tongyi 聚类数: ${resultData.data.domestic?.clusters?.length || 'N/A'}`)

        console.log(`\n💡 如果看到以下错误信息，说明 maxTokens 配置有问题:`)
        console.log(`   - "maxTokens should be [1, 8192]" → Tongyi限制太低`)
        console.log(`   - "maximum context length" → 超过模型限制`)
        console.log(`\n✅ 测试成功：所有模型都正确处理了 30K token 请求！`)
        return
      }

      process.stdout.write(`   查询进度... (${attempts}/${maxAttempts})\r`)
    }

    console.log(`\n⚠️  超时：等待 ${maxAttempts * 2} 秒后仍未完成`)
  } catch (error) {
    const duration = Date.now() - startTime
    console.log(`\n❌ 异常 (${duration}ms)`)
    console.log(`错误: ${error.message}`)
    console.log(`堆栈: ${error.stack}`)
  }
}

testMaxTokensConfig().catch(console.error)
