const { Client } = require('pg');

async function searchCoverage() {
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
    SELECT output
    FROM ai_generation_events
    WHERE task_id = '${taskId}' AND model = 'domestic'
  `);

  if (events.rows.length > 0) {
    const content = events.rows[0].output.content;

    // 查找coverage_summary区域
    const coverageStart = content.indexOf('"coverage_summary"');
    if (coverageStart > 0) {
      const coverageSection = content.substring(coverageStart, coverageStart + 2000);

      console.log('=== 覆盖度Summary区域 ===\n');
      console.log(coverageSection);

      // 尝试提取具体数值
      const totalClauses = coverageSection.match(/"total_clauses":\s*(\d+)/);
      const clusteredClauses = coverageSection.match(/"clustered_clauses":\s*(\d+)/);
      const coverageRate = coverageSection.match(/"coverage_rate":\s*([\d.]+)/);
      const missingIds = coverageSection.match(/"missing_clause_ids":\s*\[([^\]]*)\]/);

      console.log('\n=== 提取的覆盖度数据 ===\n');
      if (totalClauses) {
        console.log(`总条款数: ${totalClauses[1]}`);
      }
      if (clusteredClauses) {
        console.log(`已聚类条款数: ${clusteredClauses[1]}`);
      }
      if (coverageRate) {
        console.log(`覆盖率: ${(parseFloat(coverageRate[1]) * 100).toFixed(2)}%`);
      }
      if (missingIds) {
        const ids = missingIds[1].split(',');
        console.log(`缺失条款数: ${ids.length}`);
      }
    } else {
      console.log('未找到coverage_summary');
    }
  }

  await client.end();
}

searchCoverage().catch(console.error);
