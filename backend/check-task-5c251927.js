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

  const taskId = '5c251927-5928-4488-90c4-a8f9f621adb6';

  // 检查任务状态
  const task = await client.query(`
    SELECT id, type, status, created_at
    FROM ai_tasks
    WHERE id = '${taskId}'
  `);

  if (task.rows.length > 0) {
    console.log('=== 任务状态 ===');
    console.log('Task ID:', task.rows[0].id);
    console.log('Type:', task.rows[0].type);
    console.log('Status:', task.rows[0].status);
    console.log('Created At:', task.rows[0].created_at);
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
    console.log(`${i+1}. Model: ${e.model}, Execution Time: ${e.execution_time_ms}ms, Error: ${e.error_message || 'None'}`);
  });

  await client.end();
}

checkTaskStatus().catch(console.error);
