const { Client } = require('pg');

async function compareResults() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const task1 = '2f1284ba-8b18-40a7-a787-ed05a9a14128'; // 12月29日 - 141条款
  const task2 = '51627820-d0d1-492c-ab05-d78371fe324f'; // 今天 - 13条款

  console.log('=== 对比两个任务的详细结果 ===\n');

  for (const taskId of [task1, task2]) {
    const label = taskId === task1 ? '12月29日 (141条款)' : '今天 (13条款)';
    console.log(`\n【${label}】`);
    console.log(`任务ID: ${taskId}`);

    const res = await client.query(
      "SELECT gpt4_result, claude_result, domestic_result, selected_model FROM ai_generation_results WHERE task_id = $1",
      [taskId]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      console.log(`选中模型: ${row.selected_model}`);

      // 检查GPT-4结果
      if (row.gpt4_result) {
        try {
          const gpt4 = typeof row.gpt4_result === 'string' ? JSON.parse(row.gpt4_result) : row.gpt4_result;

          console.log(`\nGPT-4结果:`);
          console.log(`  categories数量: ${gpt4.categories?.length || 0}`);

          let totalClusters = 0;
          let totalClauses = 0;

          if (gpt4.categories) {
            gpt4.categories.forEach((cat, idx) => {
              const catClusters = cat.clusters?.length || 0;
              totalClusters += catClusters;

              console.log(`\n  Category ${idx + 1}: ${cat.name}`);
              console.log(`    描述长度: ${cat.description?.length || 0} 字符`);
              console.log(`    clusters数量: ${catClusters}`);

              cat.clusters?.forEach((cluster, cIdx) => {
                const clauseCount = cluster.clauses?.length || 0;
                totalClauses += clauseCount;

                console.log(`      Cluster ${cIdx + 1}: ${cluster.name}`);
                console.log(`        描述长度: ${cluster.description?.length || 0} 字符`);
                console.log(`        clauses数量: ${clauseCount}`);

                // 显示第一个条款
                if (clauseCount > 0 && cluster.clauses[0]) {
                  const firstClause = cluster.clauses[0];
                  console.log(`        首个条款: ${firstClause.clause_id} - ${firstClause.clause_text?.substring(0, 50)}...`);
                }
              });
            });

            console.log(`\n  总计: ${gpt4.categories.length}个大类, ${totalClusters}个聚类, ${totalClauses}个条款`);
          }

          // 显示coverage_summary
          if (gpt4.coverage_summary) {
            console.log(`\n  覆盖率统计:`);
            console.log(`    total_clauses: ${gpt4.coverage_summary.overall?.total_clauses || 'N/A'}`);
            console.log(`    clustered_clauses: ${gpt4.coverage_summary.overall?.clustered_clauses || 'N/A'}`);
            console.log(`    coverage_rate: ${gpt4.coverage_summary.overall?.coverage_rate || 'N/A'}`);
          }
        } catch (e) {
          console.log(`  解析失败: ${e.message}`);
        }
      }
    }
  }

  await client.end();
}

compareResults().catch(console.error);
