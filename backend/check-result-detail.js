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
    "SELECT id, result FROM ai_tasks WHERE id = '51627820-d0d1-492c-ab05-d78371fe324f'"
  );

  if (res.rows.length > 0) {
    const task = res.rows[0];
    console.log('=== 任务结果 ===');
    console.log('result字段类型:', typeof task.result);
    console.log('result是否为null:', task.result === null);
    console.log('result keys:', task.result ? Object.keys(task.result) : 'N/A');

    if (task.result) {
      // 检查selectedResult字段
      if (task.result.selectedResult) {
        console.log('\nselectedResult存在，类型:', typeof task.result.selectedResult);
        const selectedResult = typeof task.result.selectedResult === 'string'
          ? JSON.parse(task.result.selectedResult)
          : task.result.selectedResult;

        console.log('selectedResult.categories数量:', selectedResult.categories?.length || 0);

        if (selectedResult.categories) {
          let totalClusters = 0;
          let totalClauses = 0;

          selectedResult.categories.forEach((cat, i) => {
            console.log(`\nCategory ${i+1}: ${cat.name}`);
            console.log('  clusters数量:', cat.clusters?.length || 0);
            if (cat.clusters) {
              totalClusters += cat.clusters.length;
              cat.clusters.forEach(cluster => {
                const clauseCount = cluster.clauses?.length || 0;
                totalClauses += clauseCount;
                console.log(`    - ${cluster.name}: ${clauseCount}个条款`);
              });
            }
          });

          console.log(`\n✅ 总计: ${selectedResult.categories.length}个大类, ${totalClusters}个聚类, ${totalClauses}个条款`);
        }
      } else {
        console.log('\nselectedResult不存在');
        console.log('result的所有字段:', Object.keys(task.result));
      }
    }
  }

  await client.end();
}

checkTask().catch(console.error);
