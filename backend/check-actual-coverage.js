const { Client } = require('pg');

async function checkActualCoverage() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 检查最新任务的gpt4_result中的coverage_summary
  const taskIds = [
    '14120aaa-387a-42af-890b-5e301be520c2', // 最新 (刚刚)
    'ad274be6-44fb-489a-b77e-366ef3983495', // 10分钟前
    '501afe91-d60b-4406-a1e6-c2f3bd2a1500', // 1小时前
    '50565122-1dce-4eca-be2e-1c66073fde26', // 昨天 (用户说昨天超过90%)
  ];

  console.log('=== 对比不同时间任务的覆盖率 ===\n');

  for (const taskId of taskIds) {
    const res = await client.query(`
      SELECT t.created_at, t.input, r.gpt4_result
      FROM ai_tasks t
      LEFT JOIN ai_generation_results r ON r.task_id = t.id
      WHERE t.id = $1
    `, [taskId]);

    if (res.rows.length === 0) {
      console.log(`\n${taskId}: ❌ 任务不存在`);
      continue;
    }

    const row = res.rows[0];
    if (!row.gpt4_result) {
      console.log(`\n${taskId}: ❌ 无生成结果`);
      continue;
    }

    const inputData = typeof row.input === 'string' ? JSON.parse(row.input) : row.input;
    const gpt4Result = typeof row.gpt4_result === 'string' ? JSON.parse(row.gpt4_result) : row.gpt4_result;

    console.log(`\n${taskId}`);
    console.log(`时间: ${row.created_at}`);

    if (gpt4Result.coverage_summary) {
      const cov = gpt4Result.coverage_summary;
      console.log(`\n📊 覆盖率统计:`);
      console.log(`  总体: ${(cov.overall.coverage_rate * 100).toFixed(1)}% (${cov.overall.clustered_clauses}/${cov.overall.total_clauses})`);

      console.log(`\n按文档:`);
      Object.entries(cov.by_document).forEach(([docId, stats]) => {
        const doc = inputData.documents.find(d => d.id === docId);
        const rate = (stats.clustered_clauses / stats.total_clauses * 100).toFixed(1);
        console.log(`  ${doc?.name || docId}:`);
        console.log(`    覆盖率: ${rate}%`);
        console.log(`    已提取: ${stats.clustered_clauses}/${stats.total_clauses}`);
        console.log(`    缺失: ${stats.missing_clause_ids.length}条`);
      });

      // 统计聚类结构
      let totalClusters = 0;
      let totalClausesInClusters = 0;
      gpt4Result.categories.forEach(cat => {
        totalClusters += cat.clusters.length;
        cat.clusters.forEach(clu => {
          totalClausesInClusters += clu.clauses.length;
        });
      });

      console.log(`\n🏗️ 聚类结构:`);
      console.log(`  Categories: ${gpt4Result.categories.length}`);
      console.log(`  Clusters: ${totalClusters}`);
      console.log(`  Clauses in clusters: ${totalClausesInClusters}`);
    } else {
      console.log('\n❌ 无coverage_summary');
    }
  }

  await client.end();
}

checkActualCoverage().catch(console.error);
