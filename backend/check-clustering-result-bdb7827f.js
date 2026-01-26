const { Client } = require('pg');

async function checkClusteringResult() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = 'bdb7827f-dcb2-410b-8c0c-af025c026af4';

  // 获取任务信息
  const task = await client.query(`
    SELECT id, type, status, result
    FROM ai_tasks
    WHERE id = '${taskId}'
  `);

  if (task.rows.length > 0) {
    const t = task.rows[0];
    console.log('=== 任务信息 ===');
    console.log('Task ID:', t.id);
    console.log('Type:', t.type);
    console.log('Status:', t.status);

    // 解析result字段
    let resultData;
    if (typeof t.result === 'string') {
      resultData = JSON.parse(t.result);
    } else {
      resultData = t.result;
    }

    if (resultData) {
      console.log('\n=== 聚类结果 ===');
      console.log('选择的模型:', resultData.selectedModel || 'gpt4');
      console.log('置信度:', resultData.confidenceLevel || 'N/A');

      if (resultData.qualityScores) {
        console.log('\n质量分数:');
        console.log('  - 结构性:', resultData.qualityScores.structural || 'N/A');
        console.log('  - 语义性:', resultData.qualityScores.semantic || 'N/A');
        console.log('  - 细节:', resultData.qualityScores.detail || 'N/A');
        console.log('  - 总体:', resultData.qualityScores.overall || 'N/A');
      }

      console.log('\n聚类数量:', resultData.categories?.length || 0);

      if (resultData.categories && resultData.categories.length > 0) {
        console.log('\n前5个聚类:');
        resultData.categories.slice(0, 5).forEach((cat, i) => {
          console.log(`  ${i+1}. ${cat.name}`);
          console.log(`     描述: ${cat.description?.substring(0, 100)}...`);
          console.log(`     子聚类数: ${cat.clusters?.length || 0}`);
        });
      }
    }
  }

  // 获取AI生成事件
  const events = await client.query(`
    SELECT model, execution_time_ms, created_at
    FROM ai_generation_events
    WHERE task_id = '${taskId}'
    ORDER BY created_at ASC
  `);

  console.log('\n=== AI模型调用记录 ===');
  events.rows.forEach((e, i) => {
    console.log(`${i+1}. ${e.model}: ${e.execution_time_ms}ms`);
  });

  // 获取成本记录
  const costs = await client.query(`
    SELECT model, tokens, cost
    FROM ai_cost_tracking
    WHERE task_id = '${taskId}'
    ORDER BY created_at ASC
  `);

  console.log('\n=== AI成本记录 ===');
  let totalCost = 0;
  costs.rows.forEach((e, i) => {
    console.log(`${i+1}. ${e.model}: ${e.tokens} tokens, ¥${e.cost.toFixed(4)}`);
    totalCost += e.cost;
  });
  console.log(`总成本: ¥${totalCost.toFixed(4)}`);

  await client.end();
}

checkClusteringResult().catch(console.error);
