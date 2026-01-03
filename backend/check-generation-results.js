const { Client } = require('pg');

async function checkResults() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const res = await client.query(
    "SELECT id, task_id, model_name, model_version, raw_result, validation_status, quality_score, is_selected, created_at FROM ai_generation_results WHERE task_id = '51627820-d0d1-492c-ab05-d78371fe324f' ORDER BY created_at ASC"
  );

  console.log('=== AI生成结果 ===');
  console.log('结果数量:', res.rows.length);

  res.rows.forEach((result, i) => {
    console.log(`\n[${i+1}] ${result.model_name} (${result.model_version || 'N/A'})`);
    console.log('  结果ID:', result.id);
    console.log('  是否被选中:', result.is_selected);
    console.log('  质量分数:', result.quality_score);
    console.log('  验证状态:', result.validation_status);
    console.log('  创建时间:', result.created_at);

    if (result.raw_result) {
      try {
        const parsed = typeof result.raw_result === 'string'
          ? JSON.parse(result.raw_result)
          : result.raw_result;

        if (parsed.categories) {
          console.log('  categories数量:', parsed.categories.length);
          let totalClusters = 0;
          let totalClauses = 0;
          parsed.categories.forEach(cat => {
            totalClusters += cat.clusters?.length || 0;
            (cat.clusters || []).forEach(cluster => {
              totalClauses += cluster.clauses?.length || 0;
            });
          });
          console.log(`  聚类结构: ${totalClusters}个聚类, ${totalClauses}个条款`);

          // 显示第一个category的详情
          if (parsed.categories[0]) {
            const firstCat = parsed.categories[0];
            console.log(`  第一个分类: ${firstCat.name}`);
            console.log(`    包含聚类数: ${firstCat.clusters?.length || 0}`);
          }
        }
      } catch (e) {
        console.log('  解析失败:', e.message);
        console.log('  raw_result类型:', typeof result.raw_result);
        console.log('  raw_result前500字符:', String(result.raw_result).substring(0, 500));
      }
    }
  });

  await client.end();
}

checkResults().catch(console.error);
