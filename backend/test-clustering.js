/**
 * 聚类生成测试脚本
 * 测试多文档聚类功能
 *
 * 使用方法：
 * node backend/test-clustering.js
 */

const { v4: uuidv4 } = require('uuid')

const API_BASE_URL = 'http://localhost:3000'

// 测试文档：ISO 27001 附录A（简化版）
const ISO_27001_DOC = `
ISO/IEC 27001:2022 附录A - 信息安全控制措施

A.5 组织控制

A.5.1 信息安全策略
A.5.1.1 信息安全策略文件
组织应建立、记录、批准和传达一套信息安全策略。
策略应包括组织对信息安全的承诺和方针。

A.5.1.2 信息安全策略审查
信息安全策略应按计划间隔或发生重大变更时进行审查。

A.5.2 信息安全角色和职责
A.5.2.1 职责分配
所有信息安全职责应予以定义和分配。

A.5.2.2 职责分离
冲突的职责和责任区域应予以分离。

A.6 人员控制

A.6.1 筛选
A.6.1.1 背景调查
对所有候选人员应进行背景调查，特别是对于重要岗位。

A.6.2 雇佣条款和条件
A.6.2.1 管理责任
管理层应要求员工和承包商按照组织已建立的信息安全进行应用。

A.6.3 信息安全意识、教育和培训
A.6.3.1 信息安全意识培训
组织的所有员工和相关第三方应接受适当的意识培训。

A.7 物理和环境安全

A.7.1 安全区域
A.7.1.1 物理安全边界
应使用安全边界保护包含敏感或关键信息的区域。

A.7.1.2 物理进入控制
应通过适当的进入控制保护安全区域。

A.7.2 设备安全
A.7.2.1 设备放置和保护
应放置和保护设备，以降低来自环境威胁和危害的风险。

A.7.2.2 支持设施
应保护设备免受电源故障和其他基础设施故障的影响。

A.8 技术控制

A.8.1 用户端点设备
A.8.1.1 用户端点设备管理
应使用访问控制和授权过程保护信息的访问。

A.8.2 特权访问权限
A.8.2.1 特权访问权限管理
应限制和控制特权访问权限的分配和使用。

A.8.3 信息访问限制
A.8.3.1 信息访问限制
应根据业务需求限制对信息和其他相关资产的访问。

A.8.4 源代码访问
A.8.4.1 源代码访问
应适当限制对源代码的读写访问。
`

// 测试文档：等保2.0（简化版）
const DJBH_DOC = `
GB/T 22239-2019 信息安全技术 网络安全等级保护基本要求

7 安全技术要求

7.1 安全物理环境

7.1.1 物理位置选择
a) 机房和办公场所应选择在具有防震、防风和防雨等能力的建筑内；
b) 机房场所应避免设在建筑物的顶层或地下室。

7.1.2 物理访问控制
a) 机房出入口应配置电子门禁系统；
b) 应对进入机房的来访人员进行登记。

7.1.3 防盗窃和防破坏
a) 应将主要设备放置在机房内；
b) 应设置机房防盗报警系统。

7.2 安全通信网络

7.2.1 网络架构
a) 应保证网络设备的业务处理能力满足业务高峰期需要；
b) 应避免将重要网段部署在网络边界处。

7.2.2 通信传输
a) 应采用密码技术保证通信过程中数据的完整性；
b) 应采用密码技术保证通信过程中数据的保密性。

7.3 安全区域边界

7.3.1 边界防护
a) 应保证跨越边界的访问和数据流通过边界设备提供的受控接口进行；
b) 应能够对非授权设备私自联到内部网络的行为进行检查。

7.3.2 访问控制
a) 应在网络边界或区域之间根据访问控制策略设置访问控制规则；
b) 应删除多余或无效的访问控制规则。

7.4 安全计算环境

7.4.1 身份鉴别
a) 应对登录的用户进行身份标识和鉴别；
b) 应采用两种或两种以上组合的鉴别技术对管理员进行身份鉴别。

7.4.2 访问控制
a) 应启用访问控制功能；
b) 应根据管理用户的角色分配权限。

7.4.3 安全审计
a) 应启用安全审计功能；
b) 审计记录应包括事件的日期和时间、用户、事件类型等。

7.4.4 数据完整性
a) 应采用校验技术保证数据在传输过程中的完整性；
b) 应采用校验技术保证数据在存储过程中的完整性。

7.4.5 数据保密性
a) 应采用密码技术保证传输数据的保密性；
b) 应采用密码技术保证存储数据的保密性。

8 安全管理要求

8.1 安全管理制度

8.1.1 安全策略
a) 应制定信息安全工作的总体方针和安全策略；
b) 安全策略应由信息化领导小组审定。

8.1.2 管理制度
a) 应建立安全管理制度体系；
b) 安全管理制度应包含岗位安全职责、人员录用、培训教育等。

8.2 安全管理机构

8.2.1 岗位设置
a) 应设立信息安全管理岗位；
b) 应配备一定数量的系统管理员、网络管理员、安全管理员等。

8.2.2 授权与审批
a) 应根据各个部门和岗位的职责明确授权审批事项；
b) 应针对系统变更、重要操作建立审批程序。

8.3 安全管理人员

8.3.1 人员录用
a) 应指定或授权专门的部门或人员负责人员录用；
b) 应对被录用人的身份、安全背景等进行审查。

8.3.2 人员培训
a) 应对各类人员进行安全意识教育和岗位技能培训；
b) 应定期组织相关人员参加培训。
`

async function testClusteringGeneration() {
  console.log('========================================')
  console.log('🧪 测试聚类生成功能（多文档合并）')
  console.log('========================================\n')

  const taskId = uuidv4()
  console.log(`✅ 生成任务ID: ${taskId}\n`)

  // 1. 准备测试数据
  const documents = [
    {
      id: 'doc_iso27001',
      name: 'ISO 27001:2022 附录A',
      content: ISO_27001_DOC,
    },
    {
      id: 'doc_djbh',
      name: '等保2.0 三级要求',
      content: DJBH_DOC,
    },
  ]

  console.log('📄 准备文档：')
  documents.forEach((doc, index) => {
    console.log(`   ${index + 1}. ${doc.name} (${doc.content.length}字符)`)
  })
  console.log()

  // 2. 调用聚类API
  console.log('🚀 调用聚类生成API...')
  console.log(`   POST ${API_BASE_URL}/ai-generation/clustering\n`)

  try {
    const response = await fetch(`${API_BASE_URL}/ai-generation/clustering`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId,
        documents,
        temperature: 0.7,
        maxTokens: 16000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`API调用失败: ${response.status} - ${JSON.stringify(errorData)}`)
    }

    const result = await response.json()

    console.log('✅ 聚类生成成功！\n')

    // 3. 展示结果
    console.log('========================================')
    console.log('📊 生成结果')
    console.log('========================================\n')

    console.log(`任务ID: ${result.data.taskId}`)
    console.log(`选中模型: ${result.data.selectedModel}`)
    console.log(`置信度: ${result.data.confidenceLevel}`)
    console.log()

    console.log('质量评分:')
    console.log(
      `  结构一致性: ${(result.data.qualityScores.structural * 100).toFixed(1)}%`,
    )
    console.log(
      `  语义一致性: ${(result.data.qualityScores.semantic * 100).toFixed(1)}%`,
    )
    console.log(`  细节一致性: ${(result.data.qualityScores.detail * 100).toFixed(1)}%`)
    console.log()

    // 4. 展示聚类结果
    const clusters = result.data.selectedResult.clusters || []
    console.log(`生成聚类数量: ${clusters.length}个\n`)

    console.log('聚类详情:')
    clusters.forEach((cluster, index) => {
      console.log(`\n${index + 1}. ${cluster.name}`)
      console.log(`   描述: ${cluster.description}`)
      console.log(`   重要性: ${cluster.importance}`)
      console.log(`   风险级别: ${cluster.risk_level}`)
      console.log(`   条款数量: ${cluster.clauses.length}`)

      // 展示前3个条款
      cluster.clauses.slice(0, 3).forEach((clause, i) => {
        console.log(
          `   ${i + 1}) [${clause.source_document_name}] ${clause.clause_id}: ${clause.clause_text.substring(0, 60)}...`,
        )
      })
      if (cluster.clauses.length > 3) {
        console.log(`   ... 还有 ${cluster.clauses.length - 3} 个条款`)
      }
    })

    // 5. 展示覆盖率
    console.log('\n========================================')
    console.log('📈 覆盖率统计')
    console.log('========================================\n')

    const coverage = result.data.selectedResult.coverage_summary
    if (coverage) {
      console.log('总体覆盖率:')
      console.log(`  总条款: ${coverage.overall.total_clauses}`)
      console.log(`  已覆盖: ${coverage.overall.clustered_clauses}`)
      console.log(
        `  覆盖率: ${(coverage.overall.coverage_rate * 100).toFixed(1)}%\n`,
      )

      console.log('按文档覆盖率:')
      for (const [docId, docCoverage] of Object.entries(coverage.by_document)) {
        console.log(`  ${docId}:`)
        console.log(`    总条款: ${docCoverage.total_clauses}`)
        console.log(`    已覆盖: ${docCoverage.clustered_clauses}`)
        if (docCoverage.missing_clause_ids.length > 0) {
          console.log(
            `    遗漏: ${docCoverage.missing_clause_ids.join(', ')}`,
          )
        }
      }
    }

    console.log('\n========================================')
    console.log('🎉 测试完成！')
    console.log('========================================')
  } catch (error) {
    console.error('\n❌ 测试失败:')
    console.error(`   ${error.message}`)
    if (error.stack) {
      console.error('\n调用栈:')
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// 运行测试
testClusteringGeneration()
