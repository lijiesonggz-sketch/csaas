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
  const result = await client.query('SELECT result, progress_details FROM ai_tasks WHERE id = $1', ['33c787e5-256a-49aa-a22c-97d544f76535']);
  if (result.rows.length > 0) {
    const r = result.rows[0];
    console.log('='.repeat(70));
    console.log('聚类生成成功！');
    console.log('='.repeat(70));
    console.log('选中模型:', r.result.selectedModel);
    console.log('置信度:', r.result.confidenceLevel);
    console.log('聚类数量:', r.result.categories?.length || 0);
    console.log('质量分数:', r.result.qualityScores ? JSON.stringify(r.result.qualityScores).substring(0, 200) : 'N/A');
    console.log('\n一致性报告:', r.result.consistencyReport ? JSON.stringify(r.result.consistencyReport).substring(0, 300) + '...' : 'N/A');
    console.log('\n进度详情:', JSON.stringify(r.progress_details, null, 2));
    console.log('='.repeat(70));
  }
  await client.end();
})();
