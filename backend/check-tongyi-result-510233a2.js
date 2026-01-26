const { Client } = require('pg');

async function checkTongyiResult() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = '510233a2-e8d1-48b5-891b-ab244c0e4ffc';

  // 获取通义千问的AI生成事件
  const events = await client.query(`
    SELECT id, model, output, metadata, execution_time_ms, created_at
    FROM ai_generation_events
    WHERE task_id = '${taskId}' AND model = 'domestic'
    ORDER BY created_at ASC
  `);

  if (events.rows.length > 0) {
    const event = events.rows[0];
    console.log('=== 通义千问生成结果 ===');
    console.log('Event ID:', event.id);
    console.log('执行时间:', event.execution_time_ms, 'ms (', (event.execution_time_ms / 1000).toFixed(1), '秒)');

    if (event.output) {
      const output = typeof event.output === 'string' ? JSON.parse(event.output) : event.output;

      // 解析聚类结果
      let clusteringResult;
      if (typeof output.content === 'string') {
        clusteringResult = JSON.parse(output.content);
      } else {
        clusteringResult = output.content;
      }

      console.log('\n=== 聚类统计 ===');
      console.log('主类别数量:', clusteringResult.categories?.length || 0);

      let totalClusters = 0;
      let totalClauses = 0;

      clusteringResult.categories?.forEach((cat, idx) => {
        const clusterCount = cat.clusters?.length || 0;
        totalClusters += clusterCount;

        cat.clusters?.forEach(cluster => {
          totalClauses += cluster.clauses?.length || 0;
        });

        console.log(`\n主类别 ${idx + 1}: ${cat.name}`);
        console.log(`  描述: ${cat.description?.substring(0, 100)}...`);
        console.log(`  子聚类数: ${clusterCount}`);
      });

      console.log('\n=== 总计 ===');
      console.log('主类别数:', clusteringResult.categories?.length || 0);
      console.log('总子聚类数:', totalClusters);
      console.log('总条款数:', totalClauses);

      // 覆盖度统计
      if (clusteringResult.coverage_summary) {
        console.log('\n=== 覆盖度统计 ===');
        const coverage = clusteringResult.coverage_summary;
        console.log('总条款数:', coverage.overall?.total_clauses || 'N/A');
        console.log('已聚类条款数:', coverage.overall?.clustered_clauses || 'N/A');
        console.log('覆盖率:', coverage.overall?.coverage_rate
          ? ((coverage.overall.coverage_rate * 100).toFixed(2) + '%')
          : 'N/A');
        console.log('缺失条款数:', coverage.overall?.missing_clause_ids?.length || 0);
      }
    }
  } else {
    console.log('❌ 没有找到通义千问的生成事件');
  }

  await client.end();
}

checkTongyiResult().catch(console.error);
