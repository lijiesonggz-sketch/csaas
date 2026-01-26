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
  const result = await client.query('SELECT result FROM ai_tasks WHERE id = $1', ['33c787e5-256a-49aa-a22c-97d544f76535']);
  if (result.rows.length > 0) {
    const clusteringResult = result.rows[0].result;
    const gpt4 = clusteringResult.gpt4;
    const domestic = clusteringResult.domestic;

    console.log('='.repeat(70));
    console.log('聚类生成结果汇总');
    console.log('='.repeat(70));
    console.log('\nGPT-4 (GLM-4.7) 结果:');
    console.log('- 聚类数量:', gpt4.categories?.length || 0);
    console.log('- 聚类逻辑:', gpt4.clustering_logic?.substring(0, 80) + '...' || 'N/A');
    console.log('- 覆盖率:', gpt4.coverage_summary?.overall?.coverage_rate || 'N/A');

    console.log('\nQwen (通义千问) 结果:');
    console.log('- 聚类数量:', domestic.categories?.length || 0);
    console.log('- 聚类逻辑:', domestic.clustering_logic?.substring(0, 80) + '...' || 'N/A');
    console.log('- 覆盖率:', domestic.coverage_summary?.overall?.coverage_rate || 'N/A');

    console.log('\n' + '='.repeat(70));
    if (gpt4.categories && domestic.categories) {
      console.log('✅ 两个模型都已成功生成结果！');
      console.log('   - GPT-4:', gpt4.categories.length, '个聚类');
      console.log('   - Qwen:', domestic.categories.length, '个聚类');
    } else {
      console.log('❌ 结果不完整');
    }
    console.log('='.repeat(70));
  }
  await client.end();
})();
