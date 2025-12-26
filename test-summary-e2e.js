/**
 * 综述生成功能端到端测试脚本
 * 测试后端API和前端集成
 */

const http = require('http')
const https = require('https')

const API_BASE = 'http://localhost:3000'

// 示例ISO 27001文档（简化版）
const SAMPLE_DOCUMENT = `ISO/IEC 27001:2013 信息安全管理体系要求

1. 范围
本标准规定了建立、实施、维护和持续改进信息安全管理体系（ISMS）的要求。

2. 引用标准
ISO/IEC 27000 信息安全管理体系 - 概述和术语

3. 术语和定义
3.1 信息安全：保持信息的保密性、完整性和可用性
3.2 风险：某事件发生的可能性及其后果的结合

4. 组织环境
4.1 理解组织及其环境
组织应确定与其目标和战略方向相关的外部和内部问题。

4.2 理解相关方的需求和期望
组织应确定相关方对信息安全的要求和期望。

5. 领导作用
5.1 领导作用和承诺
最高管理者应证实其对信息安全管理体系的领导作用和承诺。

5.2 方针
最高管理者应建立信息安全方针。

5.3 组织的角色、职责和权限
最高管理者应确保分配和沟通信息安全的角色和职责。

6. 策划
6.1 应对风险和机遇的措施
组织应策划识别风险和机遇，并采取应对措施。

6.2 信息安全目标及其实现的策划
组织应在相关职能和层次上建立信息安全目标。

7. 支持
7.1 资源
组织应确定并提供建立、实施、维护和持续改进ISMS所需的资源。

7.2 能力
组织应确定在其控制下工作人员的必要能力。

7.3 意识
在组织控制下工作的人员应意识到信息安全方针的重要性。

8. 运行
8.1 运行策划和控制
组织应策划、实施和控制满足信息安全要求所需的过程。

8.2 信息安全风险评估
组织应定期或在重大变更时进行信息安全风险评估。

8.3 信息安全风险处理
组织应实施信息安全风险处理计划。

9. 绩效评价
9.1 监视、测量、分析和评价
组织应评价信息安全绩效和ISMS的有效性。

9.2 内部审核
组织应定期进行内部审核。

9.3 管理评审
最高管理者应定期评审组织的ISMS。

10. 改进
10.1 不符合和纠正措施
当发生不符合时，组织应采取纠正措施。

10.2 持续改进
组织应持续改进ISMS的适宜性、充分性和有效性。`

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http
    const req = protocol.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          const result = JSON.parse(body)
          resolve({ statusCode: res.statusCode, data: result })
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: body })
        }
      })
    })

    req.on('error', reject)

    if (data) {
      req.write(JSON.stringify(data))
    }

    req.end()
  })
}

async function runTest() {
  console.log('🧪 开始端到端测试...\n')

  // 1. 检查后端健康状态
  console.log('1️⃣ 检查后端健康状态...')
  try {
    const health = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET',
    })

    if (health.statusCode === 200) {
      console.log('✅ 后端健康检查通过:', health.data)
    } else {
      console.error('❌ 后端健康检查失败:', health)
      return
    }
  } catch (error) {
    console.error('❌ 无法连接到后端:', error.message)
    return
  }

  console.log('')

  // 2. 生成综述
  console.log('2️⃣ 发起综述生成请求...')
  const taskId = `test-${Date.now()}`

  try {
    const generateResult = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/ai-generation/summary',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        taskId,
        standardDocument: SAMPLE_DOCUMENT,
        temperature: 0.7,
        maxTokens: 4000,
      }
    )

    if (generateResult.statusCode === 201 || generateResult.statusCode === 200) {
      console.log('✅ 综述生成请求已接受')
      console.log('   Task ID:', taskId)
      console.log('   Selected Model:', generateResult.data.data?.selectedModel)
      console.log('   Confidence Level:', generateResult.data.data?.confidenceLevel)
      console.log('')
      console.log('   Quality Scores:')
      console.log(
        '   - Structural:',
        ((generateResult.data.data?.qualityScores?.structural || 0) * 100).toFixed(1) + '%'
      )
      console.log(
        '   - Semantic:',
        ((generateResult.data.data?.qualityScores?.semantic || 0) * 100).toFixed(1) + '%'
      )
      console.log(
        '   - Detail:',
        ((generateResult.data.data?.qualityScores?.detail || 0) * 100).toFixed(1) + '%'
      )

      // 显示综述内容
      const summary = generateResult.data.data?.selectedResult
      if (summary) {
        console.log('')
        console.log('📄 生成的综述内容:')
        console.log('   标题:', summary.title)
        console.log('   概述:', summary.overview?.substring(0, 100) + '...')
        console.log('   关键领域数量:', summary.key_areas?.length || 0)
        console.log('   关键要求数量:', summary.key_requirements?.length || 0)
      }
    } else {
      console.error('❌ 综述生成失败:', generateResult)
      return
    }
  } catch (error) {
    console.error('❌ 综述生成请求出错:', error.message)
    return
  }

  console.log('')

  // 3. 获取结果
  console.log('3️⃣ 获取生成结果...')
  try {
    const getResult = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/ai-generation/result/${taskId}`,
      method: 'GET',
    })

    if (getResult.statusCode === 200) {
      console.log('✅ 成功获取结果')
      console.log('   Result ID:', getResult.data.data?.id)
      console.log('   Review Status:', getResult.data.data?.reviewStatus)
      console.log('   Version:', getResult.data.data?.version)
      console.log(
        '   Created At:',
        new Date(getResult.data.data?.createdAt).toLocaleString('zh-CN')
      )
    } else {
      console.error('❌ 获取结果失败:', getResult)
    }
  } catch (error) {
    console.error('❌ 获取结果出错:', error.message)
  }

  console.log('')
  console.log('🎉 端到端测试完成！')
  console.log('')
  console.log('💡 下一步：')
  console.log('   1. 访问前端页面：http://localhost:3002/ai-generation/summary')
  console.log('   2. 粘贴上述ISO 27001文档内容')
  console.log('   3. 点击"开始生成综述"')
  console.log('   4. 观察实时进度更新')
  console.log('   5. 查看生成结果和质量评分')
}

runTest().catch(console.error)
