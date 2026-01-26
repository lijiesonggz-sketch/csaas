const { Client } = require('pg');

async function verifyTongyiCalled() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 获取最近的聚类任务
  const result = await client.query(`
    SELECT id, type, status, created_at
    FROM ai_tasks
    WHERE type = 'clustering'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.log('❌ 没有找到聚类任务');
    await client.end();
    return;
  }

  const task = result.rows[0];
  console.log('=== 最新聚类任务 ===');
  console.log('Task ID:', task.id);
  console.log('Status:', task.status);
  console.log('Created At:', task.created_at);

  // 检查AI生成事件
  const events = await client.query(`
    SELECT id, model, execution_time_ms, created_at
    FROM ai_generation_events
    WHERE task_id = $1
    ORDER BY created_at ASC
  `, [task.id]);

  console.log('\n=== AI生成事件 ===');
  console.log(`事件总数: ${events.rows.length}`);
  events.rows.forEach((e, i) => {
    console.log(`${i+1}. Model: ${e.model}, Execution Time: ${e.execution_time_ms}ms`);
  });

  // 检查是否有通义千问的调用
  const hasTongyi = events.rows.some(e => e.model === 'domestic' || e.model === 'tongyi' || e.model === 'qwen');
  console.log(`\n✅ 通义千问是否被调用: ${hasTongyi ? '是 ✓' : '否 ✗'}`);

  if (!hasTongyi && events.rows.length > 0) {
    console.log('\n⚠️ 问题：虽然任务完成，但ai_generation_events表中没有通义千问的调用记录');
    console.log('这说明：');
    console.log('1. 要么通义千问确实没有被调用');
    console.log('2. 要么被调用了但事件没有记录到数据库');
  }

  await client.end();
}

verifyTongyiCalled().catch(console.error);
