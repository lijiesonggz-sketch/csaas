const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

(async () => {
  await client.connect();

  // 查看ai_tasks表的result字段（完整的聚合结果）
  const result = await client.query(
    'SELECT result FROM ai_tasks WHERE id = $1',
    ['33c787e5-256a-49aa-a22c-97d544f76535']
  );

  if (result.rows.length > 0) {
    const r = result.rows[0].result;

    console.log('='.repeat(70));
    console.log('聚合结果分析');
    console.log('='.repeat(70));

    console.log('\n选中模型:', r.selectedModel);
    console.log('置信度:', r.confidenceLevel);

    console.log('\n质量分数:');
    console.log(JSON.stringify(r.qualityScores, null, 2));

    console.log('\n一致性报告:');
    console.log('- 一致项数量:', r.consistencyReport.agreements?.length || 0);
    console.log('- 分歧项数量:', r.consistencyReport.disagreements?.length || 0);

    if (r.consistencyReport.agreements && r.consistencyReport.agreements.length > 0) {
      console.log('\n一致项（前5项）:');
      r.consistencyReport.agreements.slice(0, 5).forEach(a => console.log('  -', a));
    }

    // 查看覆盖率对比
    console.log('\n覆盖率信息:');
    const cov = r.coverage_summary?.overall;
    if (cov) {
      console.log('- 总条款数:', cov.total_clauses);
      console.log('- 已聚类:', cov.clustered_clauses);
      console.log('- 覆盖率:', (cov.coverage_rate * 100).toFixed(1) + '%');
      const missing = cov.total_clauses - cov.clustered_clauses;
      if (missing > 0) {
        console.log('- 缺失条款数:', missing);
      }
    }

    // 检查是否有各模型的原始数据
    console.log('\nResult中的所有字段:');
    Object.keys(r).forEach(k => console.log('  -', k));

    // 检查是否有modelOutputs字段
    if (r.modelOutputs) {
      console.log('\n各模型原始结果:');
      Object.keys(r.modelOutputs).forEach(model => {
        const output = r.modelOutputs[model];
        const cov = output.coverage_summary?.overall;
        console.log('\n' + model + ':');
        console.log('  - 聚类数:', output.categories?.length || 0);
        if (cov) {
          console.log('  - 覆盖率:', (cov.coverage_rate * 100).toFixed(1) + '%');
          console.log('  - 已聚类:', cov.clustered_clauses, '/', cov.total_clauses);
          const missing = cov.total_clauses - cov.clustered_clauses;
          if (missing > 0) {
            console.log('  - 缺失:', missing, '条');
          }
        }
      });
    }
  }

  await client.end();
})();
