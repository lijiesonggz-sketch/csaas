const { Client } = require('pg');

async function checkProjectClustering() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const projectId = 'ce5c613d-fce0-4ee8-bb0a-64a23e3793dc';

  console.log('=== 检查项目聚类任务 ===\n');
  console.log('项目ID:', projectId);

  // 1. 查询项目下的所有聚类任务
  const tasksRes = await client.query(`
    SELECT id, type, status, input, created_at
    FROM ai_tasks
    WHERE project_id = $1 AND type = 'clustering'
    ORDER BY created_at DESC
  `, [projectId]);

  console.log('\n找到的聚类任务数量:', tasksRes.rows.length);

  if (tasksRes.rows.length === 0) {
    console.log('❌ 没有找到聚类任务');
    await client.end();
    return;
  }

  // 获取最新的聚类任务
  const latestTask = tasksRes.rows[0];
  const inputData = typeof latestTask.input === 'string' ? JSON.parse(latestTask.input) : latestTask.input;

  console.log('\n=== 最新聚类任务 ===');
  console.log('Task ID:', latestTask.id);
  console.log('Status:', latestTask.status);
  console.log('Created At:', latestTask.created_at);

  // 2. 检查文档内容
  console.log('\n=== 文档分析 ===');
  inputData.documents.forEach((doc, idx) => {
    const clauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || [];
    const uniqueClauses = [...new Set(clauseMatches)];
    uniqueClauses.sort();

    console.log(`\n文档 ${idx + 1}: ${doc.name}`);
    console.log('  文档ID:', doc.id);
    console.log('  内容长度:', doc.content.length, '字符');
    console.log('  检测到的条款数:', uniqueClauses.length);
    console.log('  条款列表:', uniqueClauses.join(', '));

    // 检查是否有缺失的条款（针对PBOC文档）
    if (doc.name.includes('人民银行')) {
      const expected = 54;
      const actual = uniqueClauses.length;
      if (actual < expected) {
        console.log(`  ⚠️ 预期${expected}条，实际${actual}条，缺失${expected - actual}条`);

        // 找出缺失的条款编号
        const allNumbers = ['第一条', '第二条', '第三条', '第四条', '第五条', '第六条', '第七条', '第八条', '第九条', '第十条',
          '第十一条', '第十二条', '第十三条', '第十四条', '第十五条', '第十六条', '第十七条', '第十八条', '第十九条', '第二十条',
          '第二十一条', '第二十二条', '第二十三条', '第二十四条', '第二十五条', '第二十六条', '第二十七条', '第二十八条', '第二十九条', '第三十条',
          '第三十一条', '第三十二条', '第三十三条', '第三十四条', '第三十五条', '第三十六条', '第三十七条', '第三十八条', '第三十九条', '第四十条',
          '第四十一条', '第四十二条', '第四十三条', '第四十四条', '第四十五条', '第四十六条', '第四十七条', '第四十八条', '第四十九条', '第五十条',
          '第五十一条', '第五十二条', '第五十三条', '第五十四条'];

        const missing = allNumbers.filter(id => !uniqueClauses.includes(id));
        if (missing.length > 0) {
          console.log('  缺失的条款:', missing.join(', '));

          // 检查这些缺失条款是否在文档中存在
          console.log('\n  检查文档内容中是否包含缺失条款:');
          missing.slice(0, 5).forEach(id => {
            const exists = doc.content.includes(id);
            console.log(`    ${id}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
          });
        }
      }
    }
  });

  // 3. 查询生成结果
  const resultRes = await client.query(`
    SELECT selected_model, gpt4_result, coverage_report
    FROM ai_generation_results
    WHERE task_id = $1
  `, [latestTask.id]);

  if (resultRes.rows.length > 0) {
    const result = resultRes.rows[0];
    const gpt4Result = typeof result.gpt4_result === 'string' ? JSON.parse(result.gpt4_result) : result.gpt4_result;
    const coverageReport = typeof result.coverage_report === 'string' ? JSON.parse(result.coverage_report) : result.coverage_report;

    console.log('\n=== 生成结果分析 ===');
    console.log('Selected Model:', result.selected_model);
    console.log('Overall Coverage Rate:', (coverageReport.overall.coverage_rate * 100).toFixed(1) + '%');
    console.log('Total Clauses:', coverageReport.overall.total_clauses);
    console.log('Clustered Clauses:', coverageReport.overall.clustered_clauses);

    console.log('\n按文档覆盖率:');
    Object.entries(coverageReport.by_document).forEach(([docId, stats]) => {
      const doc = inputData.documents.find(d => d.id === docId);
      console.log(`\n  ${doc?.name || docId}:`);
      console.log('    总条款数:', stats.total_clauses);
      console.log('    已提取:', stats.clustered_clauses);
      console.log('    覆盖率:', ((stats.clustered_clauses / stats.total_clauses) * 100).toFixed(1) + '%');
      console.log('    缺失条款数:', stats.missing_clause_ids.length);
      if (stats.missing_clause_ids.length <= 20) {
        console.log('    缺失条款:', stats.missing_clause_ids.join(', '));
      } else {
        console.log('    缺失条款(前20):', stats.missing_clause_ids.slice(0, 20).join(', '));
        console.log('    ...还有', stats.missing_clause_ids.length - 20, '条');
      }
    });

    // 4. 分析AI生成的聚类结构
    console.log('\n=== AI生成的聚类结构 ===');
    let totalClusters = 0;
    let totalClauses = 0;

    gpt4Result.categories.forEach((cat, catIdx) => {
      console.log(`\n类别 ${catIdx + 1}: ${cat.name}`);
      console.log('  聚类数量:', cat.clusters.length);
      totalClusters += cat.clusters.length;

      cat.clusters.forEach((cluster, clusterIdx) => {
        totalClauses += cluster.clauses.length;
      });
    });

    console.log('\n总计:');
    console.log('  Categories:', gpt4Result.categories.length);
    console.log('  Clusters:', totalClusters);
    console.log('  Clauses:', totalClauses);
    console.log('  预期Clauses:', coverageReport.overall.total_clauses);
    console.log('  实际覆盖率:', (totalClauses / coverageReport.overall.total_clauses * 100).toFixed(1) + '%');
  }

  await client.end();
}

checkProjectClustering().catch(console.error);
