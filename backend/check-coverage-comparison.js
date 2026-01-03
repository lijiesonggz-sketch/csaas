const { Client } = require('pg');

async function checkCoverageComparison() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 对比3个任务：最新的、之前的、昨天的
  const taskIds = [
    '14120aaa-387a-42af-890b-5e301be520c2', // 最新 (06:29)
    '501afe91-d60b-4406-a1e6-c2f3bd2a1500', // 之前 (05:28)
    '50565122-1dce-4eca-be2e-1c66073fde26', // 昨天 (12月31 10:27)
  ];

  for (const taskId of taskIds) {
    console.log('\n' + '='.repeat(80));
    console.log(`Task ID: ${taskId}`);
    console.log('='.repeat(80));

    // 获取任务信息
    const taskRes = await client.query(`
      SELECT id, status, created_at, input
      FROM ai_tasks
      WHERE id = $1
    `, [taskId]);

    if (taskRes.rows.length === 0) {
      console.log('❌ 任务不存在\n');
      continue;
    }

    const task = taskRes.rows[0];
    const inputData = typeof task.input === 'string' ? JSON.parse(task.input) : task.input;

    console.log('\n创建时间:', task.created_at);
    console.log('状态:', task.status);

    // 分析文档
    console.log('\n--- 文档分析 ---');
    inputData.documents.forEach((doc, idx) => {
      const clauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || [];
      const uniqueClauses = [...new Set(clauseMatches)];

      console.log(`\n文档${idx + 1}: ${doc.name}`);
      console.log('  ID:', doc.id);
      console.log('  长度:', doc.content.length, '字符');
      console.log('  条款数:', uniqueClauses.length);

      // PBOC文档特殊检查
      if (doc.name.includes('人民银行')) {
        const expected = 54;
        const actual = uniqueClauses.length;
        if (actual < expected) {
          console.log(`  ⚠️ 预期${expected}条，缺失${expected - actual}条`);

          // 检查是否包含第五条到第十三条
          const missingMiddle = !doc.content.includes('第五条') || !doc.content.includes('第十三条');
          if (missingMiddle) {
            console.log('  ❌ 确认：文档中不包含第5-13条（DOCX解析问题）');
          }
        }
      }
    });

    // 获取生成结果
    const resultRes = await client.query(`
      SELECT gpt4_result, coverage_report, selected_model
      FROM ai_generation_results
      WHERE task_id = $1
    `, [taskId]);

    if (resultRes.rows.length > 0) {
      const result = resultRes.rows[0];
      const gpt4Result = typeof result.gpt4_result === 'string' ? JSON.parse(result.gpt4_result) : result.gpt4_result;
      const coverageReport = typeof result.coverage_report === 'string' ? JSON.parse(result.coverage_report) : result.coverage_report;

      console.log('\n--- 覆盖率统计 ---');
      console.log('选择模型:', result.selected_model);
      console.log('总体覆盖率:', (coverageReport.overall.coverage_rate * 100).toFixed(1) + '%');
      console.log('总条款数:', coverageReport.overall.total_clauses);
      console.log('已提取:', coverageReport.overall.clustered_clauses);

      console.log('\n按文档:');
      Object.entries(coverageReport.by_document).forEach(([docId, stats]) => {
        const doc = inputData.documents.find(d => d.id === docId);
        const rate = (stats.clustered_clauses / stats.total_clauses * 100).toFixed(1);
        console.log(`  ${doc?.name || docId}:`);
        console.log('    覆盖率:', rate + '%');
        console.log('    缺失数:', stats.missing_clause_ids.length);
      });

      // 分析AI生成的聚类数量
      let totalClauses = 0;
      gpt4Result.categories.forEach(cat => {
        cat.clusters.forEach(cluster => {
          totalClauses += cluster.clauses.length;
        });
      });

      console.log('\n--- AI生成分析 ---');
      console.log('Categories数:', gpt4Result.categories.length);
      console.log('实际提取Clauses:', totalClauses);
      console.log('预期提取Clauses:', coverageReport.overall.total_clauses);
    }
  }

  await client.end();
}

checkCoverageComparison().catch(console.error);
