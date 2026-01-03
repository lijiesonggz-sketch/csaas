const { Client } = require('pg');

async function checkAllCoverageReports() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 查询最近10个聚类任务及其覆盖率报告
  const res = await client.query(`
    SELECT
      t.id as task_id,
      t.created_at,
      r.selected_model,
      r.coverage_report IS NOT NULL as has_coverage,
      r.gpt4_result IS NOT NULL as has_gpt4
    FROM ai_tasks t
    LEFT JOIN ai_generation_results r ON r.task_id = t.id
    WHERE t.type = 'clustering'
    ORDER BY t.created_at DESC
    LIMIT 10
  `);

  console.log('=== 最近10个聚类任务的覆盖率报告状态 ===\n');
  res.rows.forEach((row, idx) => {
    console.log(`${idx + 1}. ${row.task_id}`);
    console.log(`   时间: ${row.created_at}`);
    console.log(`   模型: ${row.selected_model || 'N/A'}`);
    console.log(`   有coverage_report: ${row.has_coverage ? '✅' : '❌'}`);
    console.log(`   有gpt4_result: ${row.has_gpt4 ? '✅' : '❌'}`);
    console.log();
  });

  await client.end();
}

checkAllCoverageReports().catch(console.error);
