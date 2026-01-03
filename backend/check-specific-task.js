const { Client } = require('pg');

async function checkTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const res = await client.query(
    "SELECT * FROM ai_generation_results WHERE task_id = '2f1284ba-8b18-40a7-a787-ed05a9a14128'"
  );

  if (res.rows.length > 0) {
    const row = res.rows[0];
    console.log('=== 12月29日的完整聚类任务 ===\n');
    console.log('任务ID:', row.task_id);
    console.log('生成类型:', row.generation_type);
    console.log('选中模型:', row.selected_model);
    console.log('置信度:', row.confidence_level);
    console.log('创建时间:', row.created_at);
    console.log('\n=== 各模型条款统计 ===\n');

    // 检查所有三个模型
    const models = [
      { name: 'GPT-4', result: row.gpt4_result },
      { name: 'Claude', result: row.claude_result },
      { name: '通义千问', result: row.domestic_result }
    ];

    models.forEach(model => {
      if (!model.result) {
        console.log(`${model.name}: 失败/null`);
        return;
      }

      try {
        const parsed = typeof model.result === 'string' ? JSON.parse(model.result) : model.result;

        // 兼容2层和3层结构
        let totalClauses = 0;
        let categories = parsed.categories || [];
        let clusters = parsed.clusters || [];

        if (categories.length > 0) {
          // 3层结构
          categories.forEach(cat => {
            (cat.clusters || []).forEach(cluster => {
              totalClauses += cluster.clauses?.length || 0;
            });
          });
          console.log(`${model.name}: ${totalClauses}条款 (3层结构, ${categories.length}个大类)`);
        } else if (clusters.length > 0) {
          // 2层结构
          clusters.forEach(cluster => {
            totalClauses += cluster.clauses?.length || 0;
          });
          console.log(`${model.name}: ${totalClauses}条款 (2层结构, ${clusters.length}个聚类)`);
        }

        // 如果是通义千问，显示详细统计
        if (model.name === '通义千问' && (categories.length > 0 || clusters.length > 0)) {
          console.log(`  详细分布:`);
          if (categories.length > 0) {
            categories.forEach((cat, idx) => {
              let catClusters = cat.clusters?.length || 0;
              let catClauses = 0;
              (cat.clusters || []).forEach(cluster => {
                catClauses += cluster.clauses?.length || 0;
              });
              console.log(`    Category ${idx+1} (${cat.name}): ${catClusters}聚类, ${catClauses}条款`);
            });
          }
        }
      } catch (e) {
        console.log(`${model.name}: 解析失败 - ${e.message}`);
      }
    });

    // 显示输入文档信息
    console.log('\n=== 从ai_tasks表查询输入信息 ===\n');
    const taskRes = await client.query(
      "SELECT input FROM ai_tasks WHERE id = '2f1284ba-8b18-40a7-a787-ed05a9a14128'"
    );

    if (taskRes.rows.length > 0) {
      const task = taskRes.rows[0];
      if (task.input && task.input.documents) {
        console.log('输入文档数量:', task.input.documents.length);
        task.input.documents.forEach((doc, i) => {
          console.log(`  文档${i+1}: ${doc.name} (${doc.content?.length || 0}字符)`);
        });
      }
    }

    // 显示质量分数
    console.log('\n=== 质量评估 ===');
    if (row.quality_scores) {
      console.log(JSON.stringify(row.quality_scores, null, 2));
    }

    // 显示一致性报告
    if (row.consistency_report) {
      console.log('\n=== 一致性报告 ===');
      console.log(JSON.stringify(row.consistency_report, null, 2).substring(0, 500));
    }
  } else {
    console.log('未找到该任务');
  }

  await client.end();
}

checkTask().catch(console.error);
