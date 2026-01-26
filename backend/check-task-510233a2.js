const { Client } = require('pg');

async function checkTaskStatus() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = '510233a2-e8d1-48b5-891b-ab244c0e4ffc';

  // 检查任务状态
  const task = await client.query(`
    SELECT id, type, status, generation_stage, progress, error_message, created_at, updated_at
    FROM ai_tasks
    WHERE id = '${taskId}'
  `);

  if (task.rows.length > 0) {
    const t = task.rows[0];
    console.log('=== 任务状态 ===');
    console.log('Task ID:', t.id);
    console.log('Type:', t.type);
    console.log('Status:', t.status);
    console.log('Generation Stage:', t.generation_stage);
    console.log('Progress:', t.progress);
    console.log('Error:', t.error_message);
    console.log('Created At:', t.created_at);
    console.log('Updated At:', t.updated_at);
  } else {
    console.log('❌ 任务不存在');
  }

  // 检查AI生成事件
  const events = await client.query(`
    SELECT id, model, execution_time_ms, error_message, created_at
    FROM ai_generation_events
    WHERE task_id = '${taskId}'
    ORDER BY created_at ASC
  `);

  console.log('\n=== AI生成事件 ===');
  console.log(`事件总数: ${events.rows.length}`);
  events.rows.forEach((e, i) => {
    console.log(`${i+1}. Model: ${e.model}, Execution: ${e.execution_time_ms}ms, Error: ${e.error_message || 'None'}`);
  });

  await client.end();
}

checkTaskStatus().catch(console.error);
