const { Client } = require('pg');

async function checkTaskResult() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = '510233a2-e8d1-48b5-891b-ab244c0e4ffc';

  // 检查任务结果
  const task = await client.query(`
    SELECT result
    FROM ai_tasks
    WHERE id = '${taskId}'
  `);

  if (task.rows.length > 0) {
    const result = task.rows[0].result;
    if (result) {
      console.log('=== 任务结果 ===');
      const resultData = typeof result === 'string' ? JSON.parse(result) : result;
      console.log('选择的模型:', resultData.selectedModel || 'N/A');
      console.log('置信度:', resultData.confidenceLevel || 'N/A');
      console.log('聚类数量:', resultData.categories?.length || 0);
      console.log('');
      console.log('前3个聚类:');
      resultData.categories?.slice(0, 3).forEach((cat, i) => {
        console.log(`  ${i+1}. ${cat.name}`);
      });
    } else {
      console.log('❌ 任务已完成，但result为空');
    }
  } else {
    console.log('❌ 任务不存在');
  }

  await client.end();
}

checkTaskResult().catch(console.error);
