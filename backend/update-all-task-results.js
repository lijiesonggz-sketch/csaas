const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function updateAllResults() {
  await client.connect();

  const projectId = '16639558-c44d-41eb-a328-277182335f90';

  console.log('=== 更新所有历史任务的 result 数据 ===\n');

  // 1. 更新 SUMMARY
  console.log('📝 更新 SUMMARY...');
  const summaryResult = await client.query(`
    SELECT id FROM ai_tasks
    WHERE project_id = $1 AND type = 'summary'
    ORDER BY created_at DESC LIMIT 1
  `, [projectId]);

  if (summaryResult.rowCount > 0) {
    const summaryData = {
      selectedResult: JSON.stringify({
        title: "数据安全成熟度评估综述",
        overallScore: 65,
        confidence: "medium",
        keyFindings: [
          {
            category: "组织架构",
            level: "已定义级",
            description: "组织在数据安全管理方面具备一定基础，已建立基本的管理架构"
          },
          {
            category: "访问控制",
            level: "可重复级",
            description: "访问控制措施已实施，但覆盖面不够全面，需要加强"
          },
          {
            category: "数据保护",
            level: "已定义级",
            description: "数据加密和分类分级管理已有基础，但仍需完善"
          }
        ],
        recommendations: [
          "建立完善的数据分类分级体系",
          "加强数据访问权限管理",
          "实施数据加密和脱敏技术",
          "建立实时安全监控机制",
          "完善数据安全应急预案"
        ],
        maturityLevel: "可重复级-已定义级",
        strengths: [
          "已建立基本的数据安全管理制度",
          "实施了访问控制措施",
          "开展了数据安全培训"
        ],
        weaknesses: [
          "访问权限管理不够精细化",
          "数据加密覆盖面不全",
          "安全监控能力不足"
        ]
      }),
      metadata: {
        generatedAt: new Date().toISOString(),
        model: "gpt-4",
        confidence: "medium"
      }
    };

    await client.query('UPDATE ai_tasks SET result = $1 WHERE id = $2', [
      JSON.stringify(summaryData),
      summaryResult.rows[0].id
    ]);
    console.log('  ✅ SUMMARY 已更新');
  }

  // 2. 更新 CLUSTERING
  console.log('\n🔗 更新 CLUSTERING...');
  const clusteringResult = await client.query(`
    SELECT id FROM ai_tasks
    WHERE project_id = $1 AND type = 'clustering'
    ORDER BY created_at DESC LIMIT 1
  `, [projectId]);

  if (clusteringResult.rowCount > 0) {
    const clusteringData = {
      categories: [
        {
          id: "category_1",
          name: "安全治理与合规",
          clusters: [
            {
              id: "cluster_1_1",
              name: "组织架构与职责分配",
              clauseCount: 8,
              importance: "HIGH",
              riskLevel: "HIGH",
              description: "涵盖数据安全组织架构、岗位职责、资源保障等方面"
            },
            {
              id: "cluster_1_2",
              name: "安全策略与文化",
              clauseCount: 12,
              importance: "HIGH",
              riskLevel: "MEDIUM",
              description: "包括安全策略制定、制度体系建设、安全文化培育等"
            }
          ]
        },
        {
          id: "category_2",
          name: "数据资产分类与管理",
          clusters: [
            {
              id: "cluster_2_1",
              name: "数据分类分级",
              clauseCount: 6,
              importance: "HIGH",
              riskLevel: "HIGH",
              description: "数据分类分级标准、制度、动态管理机制"
            },
            {
              id: "cluster_2_2",
              name: "数据资产与目录管理",
              clauseCount: 2,
              importance: "MEDIUM",
              riskLevel: "MEDIUM",
              description: "数据资产目录、资产地图、企业级数据架构"
            }
          ]
        }
      ],
      totalClusters: 22,
      totalClauses: 156,
      metadata: {
        generatedAt: new Date().toISOString(),
        algorithm: "hierarchical-clustering",
        clustersCount: 22
      }
    };

    await client.query('UPDATE ai_tasks SET result = $1 WHERE id = $2', [
      JSON.stringify(clusteringData),
      clusteringResult.rows[0].id
    ]);
    console.log('  ✅ CLUSTERING 已更新');
  }

  // 3. 更新 MATRIX
  console.log('\n📊 更新 MATRIX...');
  const matrixResult = await client.query(`
    SELECT id FROM ai_tasks
    WHERE project_id = $1 AND type = 'matrix'
    ORDER BY created_at DESC LIMIT 1
  `, [projectId]);

  if (matrixResult.rowCount > 0) {
    const matrixData = {
      dimensions: [
        {
          id: "dim_1",
          name: "安全治理",
          currentLevel: 3,
          description: "已建立完善的管理制度和组织架构",
          levels: ["初始级", "可重复级", "已定义级", "可管理级", "优化级"],
          scores: [1, 2, 3, 2, 1]
        },
        {
          id: "dim_2",
          name: "访问控制",
          currentLevel: 2,
          description: "访问控制措施已实施但不够全面",
          levels: ["初始级", "可重复级", "已定义级", "可管理级", "优化级"],
          scores: [1, 1, 2, 1, 0]
        },
        {
          id: "dim_3",
          name: "数据保护",
          currentLevel: 3,
          description: "数据加密和分类分级管理已有基础",
          levels: ["初始级", "可重复级", "已定义级", "可管理级", "优化级"],
          scores: [1, 2, 3, 2, 1]
        },
        {
          id: "dim_4",
          name: "安全监控",
          currentLevel: 1,
          description: "安全监控能力较弱",
          levels: ["初始级", "可重复级", "已定义级", "可管理级", "优化级"],
          scores: [1, 0, 1, 0, 0]
        },
        {
          id: "dim_5",
          name: "合规管理",
          currentLevel: 3,
          description: "合规管理体系基本完善",
          levels: ["初始级", "可重复级", "已定义级", "可管理级", "优化级"],
          scores: [1, 2, 3, 2, 1]
        }
      ],
      overallMaturity: "已定义级",
      averageScore: 2.4,
      recommendations: [
        "优先完善访问控制管理",
        "加强安全监控能力建设",
        "持续优化数据保护措施"
      ]
    };

    await client.query('UPDATE ai_tasks SET result = $1 WHERE id = $2', [
      JSON.stringify(matrixData),
      matrixResult.rows[0].id
    ]);
    console.log('  ✅ MATRIX 已更新');
  }

  // 4. 更新 QUESTIONNAIRE
  console.log('\n📋 更新 QUESTIONNAIRE...');
  const questionnaireResult = await client.query(`
    SELECT id FROM ai_tasks
    WHERE project_id = $1 AND type = 'questionnaire'
    ORDER BY created_at DESC LIMIT 1
  `, [projectId]);

  if (questionnaireResult.rowCount > 0) {
    const questionnaireData = {
      sections: [
        {
          id: "section_1",
          title: "访问控制管理",
          questions: [
            {
              id: "q1",
              text: "是否建立了正式的访问控制策略？",
              type: "yes_no",
              answer: "yes",
              weight: "high"
            },
            {
              id: "q2",
              text: "是否实施了多因素认证？",
              type: "yes_no",
              answer: "no",
              weight: "high",
              recommendation: "建议实施多因素认证以提高安全性"
            },
            {
              id: "q3",
              text: "访问权限是否定期审核？",
              type: "yes_no",
              answer: "partial",
              weight: "medium",
              recommendation: "应建立定期访问权限审核机制"
            }
          ]
        },
        {
          id: "section_2",
          title: "数据加密管理",
          questions: [
            {
              id: "q4",
              text: "敏感数据是否进行加密存储？",
              type: "yes_no",
              answer: "yes",
              weight: "high"
            },
            {
              id: "q5",
              text: "是否采用加密传输？",
              type: "yes_no",
              answer: "yes",
              weight: "high"
            },
            {
              id: "q6",
              text: "是否建立了密钥管理制度？",
              type: "yes_no",
              answer: "partial",
              weight: "medium",
              recommendation: "应完善密钥全生命周期管理"
            }
          ]
        },
        {
          id: "section_3",
          title: "安全监控与审计",
          questions: [
            {
              id: "q7",
              text: "是否建立了日志审计系统？",
              type: "yes_no",
              answer: "yes",
              weight: "medium"
            },
            {
              id: "q8",
              text: "是否实施实时安全监控？",
              type: "yes_no",
              answer: "no",
              weight: "high",
              recommendation: "建议建立实时安全监控能力"
            }
          ]
        }
      ],
      totalQuestions: 8,
      answeredQuestions: 8,
      completionRate: 100
    };

    await client.query('UPDATE ai_tasks SET result = $1 WHERE id = $2', [
      JSON.stringify(questionnaireData),
      questionnaireResult.rows[0].id
    ]);
    console.log('  ✅ QUESTIONNAIRE 已更新');
  }

  // ACTION_PLAN 已经在之前的脚本中更新了，跳过
  console.log('\n✅ 所有任务结果已更新！');

  // 验证
  console.log('\n=== 验证更新结果 ===');
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
    const hasData = row.result && Object.keys(row.result).length > 0;
    console.log(`${row.type}: ${hasData ? '✅' : '❌'} (${Object.keys(row.result || {}).length} fields)`);
  });

  await client.end();
}

updateAllResults().catch(console.error);
