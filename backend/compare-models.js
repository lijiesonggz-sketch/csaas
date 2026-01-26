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
  
  // 查询ai_generation_events表，看各个模型的原始结果
  const events = await client.query(
    'SELECT model, output, created_at FROM ai_generation_events WHERE task_id = $1',
    ['33c787e5-256a-49aa-a22c-97d544f76535']
  );
  
  console.log('='.repeat(70));
  console.log('各模型原始结果对比');
  console.log('='.repeat(70));
  
  events.rows.forEach(event => {
    const output = event.output;
    const coverage = output.coverage_summary?.overall;
    
    console.log('\n模型:', event.model);
    console.log('- 聚类数量:', output.categories?.length || 0);
    if (coverage) {
      console.log('- 总条款数:', coverage.total_clauses);
      console.log('- 已聚类条款数:', coverage.clustered_clauses);
      console.log('- 覆盖率:', (coverage.coverage_rate * 100).toFixed(1) + '%');
      const missing = coverage.total_clauses - coverage.clustered_clauses;
      if (missing > 0) {
        console.log('- 缺失条款数:', missing);
      }
    }
  });
  
  console.log('\n' + '='.repeat(70));
  await client.end();
})();
