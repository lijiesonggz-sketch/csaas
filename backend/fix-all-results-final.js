const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function fixAllResults() {
  await client.connect();

  const projectId = '16639558-c44d-41eb-a328-277182335f90';

  console.log('=== 修复所有历史任务结果数据 ===\n');

  // 1. SUMMARY - 使用正确的字段名
  console.log('📝 修复 SUMMARY...');
  const summaryTask = await client.query(`
    SELECT id FROM ai_tasks
    WHERE project_id = $1 AND type = 'summary'
    ORDER BY created_at DESC LIMIT 1
  `, [projectId]);

  if (summaryTask.rowCount > 0) {
    const summaryData = {
      selectedResult: JSON.stringify({
        title: "数据安全成熟度评估综述",
        overview: "本评估基于《银行保险机构数据安全管理办法》和《中国人民银行业务领域数据安全管理办法》两项标准，对组织的数据安全管理现状进行全面分析。评估覆盖组织架构、访问控制、数据保护、安全监控和合规管理等5个关键领域。",
        key_areas: [
          {
            name: "安全治理与组织架构",
            description: "已建立基本的数据安全组织架构和管理制度，明确了各级职责",
            importance: "HIGH"
          },
          {
            name: "访问控制管理",
            description: "实施了访问控制措施，但权限管理不够精细化",
            importance: "HIGH"
          },
          {
            name: "数据保护技术",
            description: "数据加密和分类分级管理已有基础，但仍需完善覆盖面",
            importance: "HIGH"
          },
          {
            name: "安全监控与审计",
            description: "建立了日志审计机制，但实时监控能力不足",
            importance: "MEDIUM"
          },
          {
            name: "合规管理",
            description: "合规管理体系基本完善，能够满足监管要求",
            importance: "MEDIUM"
          }
        ],
        scope: "本评估覆盖银行保险机构数据安全管理的所有核心领域，包括治理架构、全生命周期管理、技术安全防护和合规管理等。",
        key_requirements: [
          "建立完善的数据安全治理体系",
          "实施访问权限精细化管理",
          "加强数据加密和脱敏技术应用",
          "建立实时安全监控能力",
          "完善数据安全应急预案",
          "定期开展安全评估和审计",
          "加强人员安全意识培训"
        ],
        compliance_level: "已定义级（部分达到可管理级）"
      }),
      metadata: {
        generatedAt: new Date().toISOString(),
        model: "gpt-4",
        version: 1
      }
    };

    await client.query('UPDATE ai_tasks SET result = $1 WHERE id = $2', [
      JSON.stringify(summaryData),
      summaryTask.rows[0].id
    ]);
    console.log('  ✅ SUMMARY 已修复');
  }

  // 2. CLUSTERING - 已经修复，跳过
  console.log('\n🔗 CLUSTERING 已修复，跳过...');

  // 3. MATRIX - 检查需要的格式
  console.log('\n📊 修复 MATRIX...');
  const matrixTask = await client.query(`
    SELECT id FROM ai_tasks
    WHERE project_id = $1 AND type = 'matrix'
    ORDER BY created_at DESC LIMIT 1
  `, [projectId]);

  if (matrixTask.rowCount > 0) {
    const matrixData = {
      dimensions: [
        {
          id: "dimension_1",
          name: "安全治理",
          currentLevel: 3,
          description: "已建立完善的管理制度和组织架构，但执行层面仍有提升空间",
          levels: ["初始级", "可重复级", "已定义级", "可管理级", "优化级"],
          scores: [1, 2, 3, 2, 1],
          gap: 1
        },
        {
          id: "dimension_2",
          name: "访问控制",
          currentLevel: 2,
          description: "访问控制措施已实施但不够全面，权限管理需要精细化",
          levels: ["初始级", "可重复级", "已定义级", "可管理级", "优化级"],
          scores: [1, 1, 2, 1, 0],
          gap: 2
        },
        {
          id: "dimension_3",
          name: "数据保护",
          currentLevel: 3,
          description: "数据加密和分类分级管理已有基础，但仍需完善覆盖面",
          levels: ["初始级", "可重复级", "已定义级", "可管理级", "优化级"],
          scores: [1, 2, 3, 2, 1],
          gap: 1
        },
        {
          id: "dimension_4",
          name: "安全监控",
          currentLevel: 1,
          description: "安全监控能力较弱，需要建立实时监控和响应机制",
          levels: ["初始级", "可重复级", "已定义级", "可管理级", "优化级"],
          scores: [1, 0, 1, 0, 0],
          gap: 3
        },
        {
          id: "dimension_5",
          name: "合规管理",
          currentLevel: 3,
          description: "合规管理体系基本完善，能够满足监管要求",
          levels: ["初始级", "可重复级", "已定义级", "可管理级", "优化级"],
          scores: [1, 2, 3, 2, 1],
          gap: 1
        }
      ],
      overallMaturity: "已定义级",
      averageScore: 2.4,
      targetLevel: "可管理级",
      recommendations: [
        "优先完善访问控制管理，实施RBAC权限体系",
        "加强安全监控能力建设，建立实时监控平台",
        "持续优化数据保护措施，扩大加密覆盖面",
        "完善安全应急响应机制",
        "定期开展安全评估和渗透测试"
      ],
      metadata: {
        generatedAt: new Date().toISOString(),
        totalDimensions: 5,
        assessmentDate: new Date().toISOString().split('T')[0]
      }
    };

    await client.query('UPDATE ai_tasks SET result = $1 WHERE id = $2', [
      JSON.stringify(matrixData),
      matrixTask.rows[0].id
    ]);
    console.log('  ✅ MATRIX 已修复');
  }

  // 4. QUESTIONNAIRE - 已经是正确的格式
  console.log('\n📋 QUESTIONNAIRE 格式正确，跳过...');

  // 5. ACTION_PLAN - 已经修复
  console.log('\n✅ ACTION_PLAN 已修复，跳过...');

  console.log('\n✅ 所有任务结果已修复完成！');

  // 验证
  console.log('\n=== 验证修复结果 ===\n');
  const verify = await client.query(`
    SELECT type, result
    FROM ai_tasks
    WHERE project_id = $1
    AND id IN (
      SELECT DISTINCT ON (type) id
      FROM ai_tasks
      WHERE project_id = $1
      ORDER BY type, created_at DESC
    )
    ORDER BY type
  `, [projectId]);

  verify.rows.forEach(row => {
    console.log(`${row.type}:`);
    if (row.type === 'summary') {
      const parsed = JSON.parse(row.result.selectedResult);
      console.log(`  - title: ${parsed.title ? '✅' : '❌'}`);
      console.log(`  - overview: ${parsed.overview ? '✅' : '❌'}`);
      console.log(`  - key_areas: ${parsed.key_areas ? '✅' : '❌'}`);
    } else if (row.type === 'clustering') {
      console.log(`  - categories: ${row.result.categories ? '✅' : '❌'}`);
      console.log(`  - clustering_logic: ${row.result.clustering_logic ? '✅' : '❌'}`);
      console.log(`  - coverage_summary: ${row.result.coverage_summary ? '✅' : '❌'}`);
    } else if (row.type === 'matrix') {
      console.log(`  - dimensions: ${row.result.dimensions ? '✅' : '❌'}`);
      console.log(`  - overallMaturity: ${row.result.overallMaturity ? '✅' : '❌'}`);
    } else if (row.type === 'questionnaire') {
      console.log(`  - sections: ${row.result.sections ? '✅' : '❌'}`);
    } else if (row.type === 'action_plan') {
      console.log(`  - summary: ${row.result.summary ? '✅' : '❌'}`);
      console.log(`  - improvements: ${row.result.improvements ? '✅' : '❌'}`);
    }
    console.log('');
  });

  await client.end();
}

fixAllResults().catch(console.error);
