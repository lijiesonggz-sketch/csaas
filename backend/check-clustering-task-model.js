const { Client } = require('pg');

async function checkClusteringTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 查看最近的聚类任务
  const tasks = await client.query(`
    SELECT
      id,
      type,
      status,
      error_message,
      created_at,
      updated_at
    FROM ai_tasks
    WHERE type = 'clustering'
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log('=== 最近的聚类任务 ===\n');
  tasks.rows.forEach((task, i) => {
    console.log(`[${i + 1}] Task ID: ${task.id}`);
    console.log(`    Type: ${task.type}`);
    console.log(`    Status: ${task.status}`);
    console.log(`    Error: ${task.error_message || '无'}`);
    console.log(`    Created: ${task.created_at}`);
    console.log(`    Updated: ${task.updated_at}`);
    console.log('');
  });

  // 查看最近任务的AI生成事件
  if (tasks.rows.length > 0) {
    const latestTaskId = tasks.rows[0].id;
    console.log(`=== 查看任务 ${latestTaskId} 的AI生成事件 ===\n`);

    const events = await client.query(`
      SELECT
        id,
        task_id,
        model,
        error_message,
        execution_time_ms,
        created_at
      FROM ai_generation_events
      WHERE task_id = $1
      ORDER BY created_at ASC
    `, [latestTaskId]);

    if (events.rows.length === 0) {
      console.log('⚠️ 该任务没有AI生成事件记录！\n');
    } else {
      events.rows.forEach((event, i) => {
        console.log(`[${i + 1}] Event ID: ${event.id}`);
        console.log(`    Model: ${event.model}`);
        console.log(`    Execution Time: ${event.execution_time_ms || 0}ms`);
        console.log(`    Error: ${event.error_message || '无'}`);
        console.log(`    Created: ${event.created_at}`);
        console.log('');
      });
    }
  }

  await client.end();
}

checkClusteringTasks().catch(console.error);
