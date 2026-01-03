const { Client } = require('pg');

async function checkAllTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const res = await client.query(`
    SELECT
      t.id,
      t.created_at,
      t.status,
      r.gpt4_result,
      r.domestic_result,
      r.selected_model
    FROM ai_tasks t
    LEFT JOIN ai_generation_results r ON r.task_id = t.id
    WHERE t.type = 'clustering' AND t.status = 'completed'
    ORDER BY t.created_at DESC
    LIMIT 10
  `);

  console.log('=== 最近的10个完成的聚类任务 ===\n');

  for (let i = 0; i < res.rows.length; i++) {
    const row = res.rows[i];
    const date = row.created_at.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    console.log(`[${i+1}] ${date}`);
    console.log(`    任务ID: ${row.id}`);
    console.log(`    选中: ${row.selected_model || 'N/A'}`);

    // 检查通义千问的结果
    if (row.domestic_result) {
      try {
        const domestic = typeof row.domestic_result === 'string'
          ? JSON.parse(row.domestic_result)
          : row.domestic_result;

        // 兼容2层和3层结构
        let items = domestic.categories || domestic.clusters || [];
        let totalClauses = 0;

        // 3层结构：categories -> clusters -> clauses
        if (domestic.categories) {
          domestic.categories.forEach(cat => {
            (cat.clusters || []).forEach(cluster => {
              totalClauses += cluster.clauses?.length || 0;
            });
          });
        }
        // 2层结构：clusters -> clauses
        else if (domestic.clusters) {
          domestic.clusters.forEach(cluster => {
            totalClauses += cluster.clauses?.length || 0;
          });
        }

        console.log(`    通义: ${totalClauses}条款`);
      } catch (e) {
        console.log(`    通义: 解析失败`);
      }
    }

    console.log('');
  }

  await client.end();
}

checkAllTasks().catch(console.error);
