const { Client } = require('pg');

async function checkTongyiUsage() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 检查最近的AI生成事件，特别是通义千问的调用
  const res = await client.query(`
    SELECT
      id,
      task_id,
      model,
      error_message,
      execution_time_ms,
      created_at
    FROM ai_generation_events
    WHERE model = 'domestic'
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.log('=== 通义千问（domestic模型）最近的调用记录 ===\n');

  if (res.rows.length === 0) {
    console.log('⚠️ 没有找到通义千问的调用记录！');
    console.log('\n检查所有模型的调用记录...');

    const allModels = await client.query(`
      SELECT model, COUNT(*) as count
      FROM ai_generation_events
      GROUP BY model
      ORDER BY count DESC
    `);

    console.log('\n所有模型的调用统计:');
    allModels.rows.forEach(r => {
      console.log(`  ${r.model}: ${r.count} 次调用`);
    });
  } else {
    res.rows.forEach((r, i) => {
      console.log(`[${i + 1}] Event ID: ${r.id}`);
      console.log(`    Task ID: ${r.task_id}`);
      console.log(`    Model: ${r.model}`);
      console.log(`    Execution Time: ${r.execution_time_ms || 0}ms`);
      console.log(`    Error: ${r.error_message || '无'}`);
      console.log(`    Created: ${r.created_at}`);
      console.log('');
    });
  }

  await client.end();
}

checkTongyiUsage().catch(console.error);
