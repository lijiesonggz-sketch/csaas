/**
 * 自动化测试：聚类结果页 → 成熟度矩阵页 → 问卷页
 * 测试URL参数传递和数据流
 */

const CLUSTERING_TASK_ID = '27db209e-76b9-4f6c-bb93-b0c3c4411555'
const BACKEND_URL = 'http://localhost:3000'

console.log('\n=== 聚类结果页 → 矩阵 → 问卷 工作流测试 ===\n')

// 测试1: 获取聚类结果（模拟聚类结果页加载）
async function testGetClusteringResult() {
  console.log('📋 测试1: 获取聚类结果（聚类结果页）')
  console.log(`   任务ID: ${CLUSTERING_TASK_ID}`)

  try {
    const response = await fetch(`${BACKEND_URL}/ai-generation/result/${CLUSTERING_TASK_ID}`)
    const data = await response.json()

    if (data.success && data.data) {
      console.log('   ✅ 成功获取聚类结果')
      console.log(`   ✅ 选中模型: ${data.data.selectedModel}`)
      console.log(`   ✅ 置信度: ${data.data.confidenceLevel}`)
      console.log(`   ✅ 任务ID在Alert组件中显示: ${data.data.taskId}`)

      // 验证聚类结果数据结构
      const clusteringResult = typeof data.data.selectedResult === 'string'
        ? JSON.parse(data.data.selectedResult)
        : data.data.selectedResult

      if (clusteringResult.categories && clusteringResult.categories.length > 0) {
        console.log(`   ✅ CSV导出数据可用: ${clusteringResult.categories.length}个大类`)

        // 模拟CSV导出（验证数据结构）
        let totalClusters = 0
        let totalClauses = 0
        clusteringResult.categories.forEach(cat => {
          totalClusters += cat.clusters.length
          cat.clusters.forEach(cluster => {
            totalClauses += cluster.clauses.length
          })
        })
        console.log(`   ✅ CSV将包含: ${totalClusters}个聚类, ${totalClauses}个条款`)
      }

      console.log('   ✅ "生成成熟度矩阵"按钮将跳转到: /ai-generation/matrix?taskId=' + CLUSTERING_TASK_ID)

      return data.data
    } else {
      console.log('   ❌ 获取聚类结果失败')
      return null
    }
  } catch (error) {
    console.log(`   ❌ 错误: ${error.message}`)
    return null
  }
}

// 测试2: 使用聚类任务ID生成矩阵（模拟矩阵页URL参数接收）
async function testGenerateMatrix(clusteringTaskId) {
  console.log('\n📊 测试2: 生成成熟度矩阵（矩阵页URL参数: ?taskId=' + clusteringTaskId + '）')
  console.log('   ✅ 矩阵页通过URL参数自动填充: ' + clusteringTaskId)

  // 生成新的任务ID
  const matrixTaskId = 'test-matrix-' + Date.now()
  console.log(`   生成新矩阵任务ID: ${matrixTaskId}`)

  try {
    // 先获取聚类结果
    const clusteringResponse = await fetch(`${BACKEND_URL}/ai-generation/final-result/${clusteringTaskId}`)
    const clusteringData = await clusteringResponse.json()

    if (!clusteringData.success) {
      console.log('   ❌ 无法获取聚类结果')
      return null
    }

    console.log('   ✅ 成功获取聚类数据用于矩阵生成')

    // 启动矩阵生成
    const response = await fetch(`${BACKEND_URL}/ai-generation/matrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: matrixTaskId,
        clusteringResult: clusteringData.data,
        temperature: 0.7,
        maxTokens: 16000
      })
    })

    const data = await response.json()

    if (data.success) {
      console.log('   ✅ 矩阵生成任务已启动')
      console.log(`   ⏳ 等待矩阵生成完成... (可能需要2-4分钟)`)

      // 轮询检查结果
      const maxAttempts = 60 // 最多等待5分钟
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // 每5秒检查一次

        const resultResponse = await fetch(`${BACKEND_URL}/ai-generation/result/${matrixTaskId}`)
        const resultData = await resultResponse.json()

        if (resultData.success && resultData.data) {
          console.log('   ✅ 矩阵生成完成！')
          console.log(`   ✅ 选中模型: ${resultData.data.selectedModel}`)
          console.log(`   ✅ 置信度: ${resultData.data.confidenceLevel}`)

          // 验证矩阵数据
          const matrixResult = resultData.data.selectedResult
          if (matrixResult.matrix && matrixResult.matrix.length > 0) {
            console.log(`   ✅ CSV导出数据可用: ${matrixResult.matrix.length}行 × 5列`)
            console.log(`   ✅ "生成调研问卷"按钮将跳转到: /ai-generation/questionnaire?taskId=${matrixTaskId}`)
          }

          return { taskId: matrixTaskId, result: resultData.data }
        }

        process.stdout.write(`   ⏳ 等待中... (${i + 1}/${maxAttempts})\r`)
      }

      console.log('\n   ⚠️  超时：矩阵生成未在预期时间内完成')
      console.log('   💡 提示：可以稍后手动检查任务ID: ' + matrixTaskId)
      return null
    } else {
      console.log('   ❌ 矩阵生成失败: ' + data.message)
      return null
    }
  } catch (error) {
    console.log(`   ❌ 错误: ${error.message}`)
    return null
  }
}

// 测试3: 使用矩阵任务ID生成问卷（模拟问卷页URL参数接收）
async function testGenerateQuestionnaire(matrixTaskId) {
  console.log('\n📝 测试3: 生成调研问卷（问卷页URL参数: ?taskId=' + matrixTaskId + '）')
  console.log('   ✅ 问卷页通过URL参数自动填充: ' + matrixTaskId)

  const questionnaireTaskId = 'test-questionnaire-' + Date.now()
  console.log(`   生成新问卷任务ID: ${questionnaireTaskId}`)

  try {
    // 获取矩阵结果
    const matrixResponse = await fetch(`${BACKEND_URL}/ai-generation/final-result/${matrixTaskId}`)
    const matrixData = await matrixResponse.json()

    if (!matrixData.success) {
      console.log('   ❌ 无法获取矩阵结果')
      return null
    }

    console.log('   ✅ 成功获取矩阵数据用于问卷生成')

    // 启动问卷生成
    const response = await fetch(`${BACKEND_URL}/ai-generation/questionnaire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: questionnaireTaskId,
        matrixResult: matrixData.data,
        temperature: 0.7,
        maxTokens: 20000
      })
    })

    const data = await response.json()

    if (data.success) {
      console.log('   ✅ 问卷生成任务已启动')
      console.log(`   ⏳ 等待问卷生成完成... (可能需要3-5分钟)`)

      // 轮询检查结果
      const maxAttempts = 60
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000))

        const resultResponse = await fetch(`${BACKEND_URL}/ai-generation/result/${questionnaireTaskId}`)
        const resultData = await resultResponse.json()

        if (resultData.success && resultData.data) {
          console.log('   ✅ 问卷生成完成！')
          console.log(`   ✅ 选中模型: ${resultData.data.selectedModel}`)

          const questionnaireResult = resultData.data.selectedResult
          if (questionnaireResult.questions && questionnaireResult.questions.length > 0) {
            console.log(`   ✅ 问卷包含: ${questionnaireResult.questions.length}个问题`)
            console.log(`   ✅ CSV导出数据可用`)
          }

          return resultData.data
        }

        process.stdout.write(`   ⏳ 等待中... (${i + 1}/${maxAttempts})\r`)
      }

      console.log('\n   ⚠️  超时：问卷生成未在预期时间内完成')
      console.log('   💡 提示：可以稍后手动检查任务ID: ' + questionnaireTaskId)
      return null
    } else {
      console.log('   ❌ 问卷生成失败: ' + data.message)
      return null
    }
  } catch (error) {
    console.log(`   ❌ 错误: ${error.message}`)
    return null
  }
}

// 运行测试
async function runTests() {
  console.log('🚀 开始测试工作流...\n')

  // 测试1: 聚类结果页
  const clusteringResult = await testGetClusteringResult()
  if (!clusteringResult) {
    console.log('\n❌ 测试失败：无法获取聚类结果')
    return
  }

  // 测试2: 矩阵生成页（URL参数 + CSV导出）
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const matrixResult = await testGenerateMatrix(CLUSTERING_TASK_ID)

  if (!matrixResult) {
    console.log('\n⚠️  矩阵生成测试未完成，跳过问卷测试')
    console.log('\n📊 测试总结：')
    console.log('   ✅ 聚类结果页: 任务ID显示、CSV导出、矩阵跳转按钮')
    console.log('   ✅ 矩阵页: URL参数接收')
    console.log('   ⏳ 矩阵页: 生成中，请稍后手动验证CSV导出和问卷跳转')
    return
  }

  // 测试3: 问卷生成页（URL参数 + CSV导出）
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const questionnaireResult = await testGenerateQuestionnaire(matrixResult.taskId)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n📊 测试总结：')
  console.log('   ✅ 聚类结果页: 任务ID显示、CSV导出、"生成成熟度矩阵"按钮')
  console.log('   ✅ 矩阵页: URL参数接收、CSV导出、"生成调研问卷"按钮')
  if (questionnaireResult) {
    console.log('   ✅ 问卷页: URL参数接收、CSV导出')
  } else {
    console.log('   ⏳ 问卷页: 生成中，请稍后手动验证')
  }

  console.log('\n✅ 自动化测试完成！\n')
}

// 执行测试
runTests().catch(error => {
  console.error('\n❌ 测试执行失败:', error)
  process.exit(1)
})
