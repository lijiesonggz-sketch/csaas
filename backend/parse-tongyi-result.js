const { Client } = require('pg');

async function parseTongyiResult() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = '510233a2-e8d1-48b5-891b-ab244c0e4ffc';

  const events = await client.query(`
    SELECT id, model, output
    FROM ai_generation_events
    WHERE task_id = '${taskId}' AND model = 'domestic'
  `);

  if (events.rows.length > 0) {
    const event = events.rows[0];
    const contentStr = event.output.content;

    console.log('=== 通义千问聚类结果 ===');
    console.log('执行时间:', event.output.metadata?.executionTimeMs || 'N/A', 'ms');

    try {
      // 尝试清理JSON字符串（处理可能的问题）
      let cleanedStr = contentStr;

      // 处理常见的JSON问题
      cleanedStr = cleanedStr.replace(/\\n/g, '\\n');
      cleanedStr = cleanedStr.replace(/\r\n/g, '\\n');

      const result = JSON.parse(cleanedStr);

      console.log('\n=== 聚类统计 ===');
      console.log('主类别数量:', result.categories?.length || 0);

      let totalClusters = 0;
      let totalClauses = 0;

      result.categories?.forEach((cat, idx) => {
        const clusterCount = cat.clusters?.length || 0;
        totalClusters += clusterCount;

        cat.clusters?.forEach(cluster => {
          totalClauses += cluster.clauses?.length || 0;
        });

        console.log(`\n${idx + 1}. ${cat.name}`);
        console.log(`   描述: ${(cat.description || '').substring(0, 60)}...`);
        console.log(`   子聚类数: ${clusterCount}`);
      });

      console.log('\n=== 总计 ===');
      console.log('主类别数:', result.categories?.length || 0);
      console.log('总子聚类数:', totalClusters);
      console.log('总条款数:', totalClauses);

      // 覆盖度统计
      if (result.coverage_summary) {
        console.log('\n=== 覆盖度统计 ===');
        const coverage = result.coverage_summary;
        console.log('文档级覆盖率:');
        Object.entries(coverage.by_document || {}).forEach(([docId, docCoverage]) => {
          console.log(`  文档 ${docId}:`);
          console.log(`    总条款: ${docCoverage.total_clauses}`);
          console.log(`    已聚类: ${docCoverage.clustered_clauses}`);
          console.log(`    覆盖率: ${((docCoverage.coverage_rate || 0) * 100).toFixed(2)}%`);
        });

        console.log('\n总体覆盖率:');
        console.log(`  总条款数: ${coverage.overall?.total_clauses || 'N/A'}`);
        console.log(`  已聚类条款数: ${coverage.overall?.clustered_clauses || 'N/A'}`);
        console.log(`  覆盖率: ${coverage.overall?.coverage_rate
          ? ((coverage.overall.coverage_rate * 100).toFixed(2) + '%')
          : 'N/A'}`);
        console.log(`  缺失条款数: ${coverage.overall?.missing_clause_ids?.length || 0}`);
      }

    } catch (err) {
      console.log('\n❌ JSON解析失败:', err.message);

      // 尝试显示前500个字符，帮助调试
      console.log('\n前500个字符预览:');
      console.log(contentStr.substring(0, 500));
    }
  }

  await client.end();
}

parseTongyiResult().catch(console.error);
