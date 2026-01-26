const { Client } = require('pg');

async function checkEvents() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const res = await client.query(
    "SELECT id, model, input, output, error_message, execution_time_ms, created_at FROM ai_generation_events WHERE task_id = $1 ORDER BY created_at ASC",
    ['33c787e5-256a-49aa-a22c-97d544f76535']
  );

  console.log('=== AI生成事件 ===');
  console.log('事件数量:', res.rows.length);

  res.rows.forEach((event, i) => {
    console.log(`\n[${i+1}] ${event.model}`);
    console.log('  创建时间:', event.created_at);
    console.log('  执行时间:', event.execution_time_ms, 'ms');
    console.log('  错误:', event.error_message || '无');

    if (event.input && event.input.prompt) {
      console.log('  Prompt长度:', event.input.prompt.length, '字符');
    }

    if (event.output) {
      console.log('  Output keys:', Object.keys(event.output));
      if (event.output.content) {
        console.log('  响应内容长度:', event.output.content.length, '字符');
        try {
          const parsed = typeof event.output.content === 'string'
            ? JSON.parse(event.output.content)
            : event.output.content;
          console.log('  聚类结果解析成功');
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
            console.log(`  总计: ${totalClusters}个聚类, ${totalClauses}个条款`);
          }
          if (parsed.coverage_summary?.overall) {
            const cov = parsed.coverage_summary.overall;
            console.log('  覆盖率: ' + (cov.coverage_rate * 100).toFixed(1) + '%');
            console.log('  总条款: ' + cov.total_clauses);
            console.log('  已聚类: ' + cov.clustered_clauses);
            const missing = cov.total_clauses - cov.clustered_clauses;
            if (missing > 0) {
              console.log('  缺失: ' + missing + ' 条');
            }
          }
        } catch (e) {
          console.log('  解析失败:', e.message);
          console.log('  响应前500字符:', String(event.output.content).substring(0, 500));
        }
      }
    } else {
      console.log('  Output: null');
    }
  });

  await client.end();
}

checkEvents().catch(console.error);
