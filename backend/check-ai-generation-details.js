const { Client } = require('pg');

async function checkAIGeneration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = '501afe91-d60b-4406-a1e6-c2f3bd2a1500';

  // 获取AI生成事件
  const res = await client.query(`
    SELECT model, output, metadata, execution_time_ms, error_message
    FROM ai_generation_events
    WHERE task_id = $1
    ORDER BY created_at
  `, [taskId]);

  console.log('=== AI生成事件详情 ===\n');
  res.rows.forEach((event, idx) => {
    console.log(`调用 ${idx + 1}: ${event.model}`);
    const output = typeof event.output === 'string' ? JSON.parse(event.output) : event.output;
    console.log(`  输入Token: ${output?.tokens?.prompt || 'N/A'}`);
    console.log(`  输出Token: ${output?.tokens?.completion || 'N/A'}`);
    console.log(`  总Token: ${output?.tokens?.total || 'N/A'}`);
    console.log(`  成本: $${output?.cost ? output.cost.toFixed(4) : 'N/A'}`);
    console.log(`  停止原因: ${output?.metadata?.stopReason || 'N/A'}`);
    console.log(`  执行时间: ${event.execution_time_ms || 'N/A'}ms`);
    if (event.error_message) {
      console.log(`  ❌ 错误: ${event.error_message}`);
    }
    console.log();
  });

  // 检查GPT-4结果的大小
  const resultRes = await client.query(`
    SELECT selected_model, gpt4_result
    FROM ai_generation_results
    WHERE task_id = $1
  `, [taskId]);

  if (resultRes.rows.length > 0) {
    const result = resultRes.rows[0];
    const gpt4Result = typeof result.gpt4_result === 'string' ? JSON.parse(result.gpt4_result) : result.gpt4_result;

    console.log('=== GPT-4结果分析 ===');
    console.log('Selected Model:', result.selected_model);
    console.log('Categories数量:', gpt4Result.categories?.length || 0);

    let totalClusters = 0;
    let totalClauses = 0;
    gpt4Result.categories?.forEach(cat => {
      totalClusters += cat.clusters?.length || 0;
      cat.clusters?.forEach(cluster => {
        totalClauses += cluster.clauses?.length || 0;
      });
    });

    console.log('总Clusters数量:', totalClusters);
    console.log('总Clauses数量:', totalClauses);
    console.log('预期Clauses数量: 123 (78 + 45)');
    console.log('实际覆盖率:', (totalClauses / 123 * 100).toFixed(1) + '%');
    console.log('缺失Clauses数量:', 123 - totalClauses);
  }

  await client.end();
}

checkAIGeneration().catch(console.error);
