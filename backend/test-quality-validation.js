/**
 * 测试质量验证服务（使用通义千问 Embedding API）
 */

require('dotenv').config({ path: '.env.development' });

const { Client } = require('pg');

// 模拟3个AI模型的聚类结果
const mockResults = {
  gpt4: {
    categories: [
      {
        id: 'cat-1',
        name: '安全管理',
        description: '组织内部安全策略和管理机制',
        clusters: [
          {
            id: 'cluster-1',
            name: '安全策略制定',
            clauses: [
              { id: 'c1', source: 'ISO 27001:2022', text: 'A.5.1.1 制定信息安全政策' },
              { id: 'c2', source: 'ISO 27001:2022', text: 'A.5.1.2 评审信息安全政策' }
            ]
          }
        ]
      }
    ],
    coverage_summary: {
      total_clauses: 10,
      covered_clauses: 9,
      coverage_rate: 0.9
    }
  },
  claude: {
    categories: [
      {
        id: 'cat-1',
        name: '安全策略',
        description: '安全治理和政策制定',
        clusters: [
          {
            id: 'cluster-1',
            name: '安全政策管理',
            clauses: [
              { id: 'c1', source: 'ISO 27001:2022', text: 'A.5.1.1 制定信息安全政策' },
              { id: 'c2', source: 'ISO 27001:2022', text: 'A.5.1.2 评审信息安全政策' }
            ]
          }
        ]
      }
    ],
    coverage_summary: {
      total_clauses: 10,
      covered_clauses: 8,
      coverage_rate: 0.8
    }
  },
  domestic: {
    categories: [
      {
        id: 'cat-1',
        name: '安全管理',
        description: '组织安全管理体系',
        clusters: [
          {
            id: 'cluster-1',
            name: '制定安全策略',
            clauses: [
              { id: 'c1', source: 'ISO 27001:2022', text: 'A.5.1.1 制定信息安全政策' },
              { id: 'c2', source: 'ISO 27001:2022', text: 'A.5.1.2 评审信息安全政策' }
            ]
          }
        ]
      }
    ],
    coverage_summary: {
      total_clauses: 10,
      covered_clauses: 9,
      coverage_rate: 0.9
    }
  }
};

async function testQualityValidation() {
  console.log('=== 测试质量验证服务（通义千问 Embedding） ===\n');

  // 检查环境变量
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.TONGYI_API_KEY;
  if (!apiKey) {
    console.log('❌ DASHSCOPE_API_KEY 或 TONGYI_API_KEY 未配置');
    process.exit(1);
  }
  console.log('✅ API Key 已配置:', apiKey.substring(0, 10) + '...');

  // 测试1: 直接调用 Embedding API
  console.log('\n【测试1】直接调用 DashScope Embedding API...');
  try {
    const response = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-v2',
          input: {
            texts: ['测试文本1', '测试文本2']
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('✅ Embedding API 调用成功');
    console.log('   Embedding 维度:', data.output.embeddings[0].embedding.length);
    console.log('   Token使用:', data.usage.total_tokens);
  } catch (error) {
    console.log('❌ Embedding API 调用失败:', error.message);
    process.exit(1);
  }

  // 测试2: 调用后端的质量验证接口
  console.log('\n【测试2】调用后端质量验证接口...');
  try {
    const response = await fetch('http://localhost:3000/ai-generation/test/quality-validation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mockResults)
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('404 - 接口不存在');
      }
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('✅ 质量验证接口调用成功');
    console.log('   结构一致性:', data.consistencyReport.structuralScore.toFixed(4));
    console.log('   语义一致性:', data.consistencyReport.semanticScore.toFixed(4));
    console.log('   细节一致性:', data.consistencyReport.detailScore.toFixed(4));
    console.log('   总体分数:', data.consistencyReport.overallScore.toFixed(4));
    console.log('   置信度:', data.confidenceLevel);
    console.log('   是否通过:', data.passed ? '✅' : '❌');
  } catch (error) {
    if (error.message.includes('404')) {
      console.log('⚠️  后端没有测试接口，这是正常的');
      console.log('   我们将通过实际生成任务来测试');
      console.log('\n【测试3】检查数据库中的最近生成任务...');
    } else {
      console.log('❌ 质量验证接口调用失败:', error.message);
    }
  }

  // 测试3: 查询最近的生成任务
  console.log('\n【测试3】检查最近完成的质量验证任务...');
  try {
    const client = new Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'postgres',
      database: 'csaas'
    });

    await client.connect();

    const result = await client.query(`
      SELECT
        agr.id,
        agr.task_id,
        agr.selected_model,
        agr.confidence_level,
        agr.quality_scores,
        agr.created_at
      FROM ai_generation_results agr
      ORDER BY agr.created_at DESC
      LIMIT 3
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  数据库中没有生成结果记录');
      console.log('   需要运行一个实际的任务来测试质量验证');
    } else {
      console.log('✅ 找到', result.rows.length, '个最近的生成结果');

      result.rows.forEach((row, index) => {
        console.log(`\n   [结果${index + 1}] ID: ${row.id.substring(0, 8)}...`);
        console.log('   任务ID:', row.task_id.substring(0, 8), '...');
        console.log('   选中模型:', row.selected_model);
        console.log('   置信度:', row.confidence_level);

        if (row.quality_scores) {
          const scores = JSON.parse(row.quality_scores);
          console.log('   质量分数:');
          console.log('     - 结构:', scores.structural?.toFixed(4) || 'N/A');
          console.log('     - 语义:', scores.semantic?.toFixed(4) || 'N/A');
          console.log('     - 细节:', scores.detail?.toFixed(4) || 'N/A');
        }
        console.log('   创建时间:', row.created_at);
      });
    }

    await client.end();
  } catch (error) {
    console.log('❌ 数据库查询失败:', error.message);
  }

  console.log('\n=== 测试完成 ===');
  console.log('\n📋 结论:');
  console.log('1. ✅ 通义千问 Embedding API 可用');
  console.log('2. ⏳ 质量验证服务需要通过实际任务验证');
  console.log('\n💡 建议:');
  console.log('- 创建一个新的聚类任务');
  console.log('- 观察质量验证过程是否使用 DashScope Embedding');
  console.log('- 检查后端日志中的相似度计算输出');
}

testQualityValidation().catch(console.error);
