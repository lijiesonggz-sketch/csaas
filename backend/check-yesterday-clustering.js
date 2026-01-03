const { Client } = require('pg');

async function checkYesterdayTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 查找昨天的所有聚类任务
  const res = await client.query(`
    SELECT
      t.id,
      t.status,
      t.created_at,
      r.gpt4_result,
      r.claude_result,
      r.domestic_result,
      r.selected_model
    FROM ai_tasks t
    LEFT JOIN ai_generation_results r ON r.task_id = t.id
    WHERE t.type = 'clustering'
    ORDER BY t.created_at DESC
    LIMIT 5
  `);

  console.log('=== 最近的5个聚类任务 ===\n');

  for (let i = 0; i < res.rows.length; i++) {
    const row = res.rows[i];
    console.log(`[${i+1}] 任务ID: ${row.id}`);
    console.log(`    创建时间: ${row.created_at}`);
    console.log(`    状态: ${row.status}`);
    console.log(`    选中模型: ${row.selected_model || 'N/A'}`);

    // 检查通义千问的结果
    if (row.domestic_result) {
      try {
        const domestic = typeof row.domestic_result === 'string'
          ? JSON.parse(row.domestic_result)
          : row.domestic_result;

        if (domestic.categories) {
          let totalClauses = 0;
          domestic.categories.forEach(cat => {
            (cat.clusters || []).forEach(cluster => {
              totalClauses += cluster.clauses?.length || 0;
            });
          });
          console.log(`    通义千问条款数: ${totalClauses}`);
        }
      } catch (e) {
        console.log(`    通义千问解析失败`);
      }
    }

    // 检查GPT-4的结果
    if (row.gpt4_result) {
      try {
        const gpt4 = typeof row.gpt4_result === 'string'
          ? JSON.parse(row.gpt4_result)
          : row.gpt4_result;

        if (gpt4.categories) {
          let totalClauses = 0;
          gpt4.categories.forEach(cat => {
            (cat.clusters || []).forEach(cluster => {
              totalClauses += cluster.clauses?.length || 0;
            });
          });
          console.log(`    GPT-4条款数: ${totalClauses}`);
        }
      } catch (e) {
        console.log(`    GPT-4解析失败`);
      }
    }

    console.log('');
  }

  await client.end();
}

checkYesterdayTasks().catch(console.error);
