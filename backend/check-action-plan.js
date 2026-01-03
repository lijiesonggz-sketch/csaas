const { Client } = require('pg');

async function checkTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    // 查询最新的 action_plan 任务
    const tasks = await client.query(`
      SELECT id, status, error_message, created_at, updated_at
      FROM ai_tasks
      WHERE type = 'action_plan'
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log('=== 最新 action_plan 任务 ===\n');

    for (const task of tasks.rows) {
      console.log('Task ID:', task.id);
      console.log('Status:', task.status);
      console.log('Error:', task.error_message || 'None');
      console.log('Created:', task.created_at);
      console.log('Updated:', task.updated_at);

      // 查询该任务的事件
      const events = await client.query(`
        SELECT timestamp, event_type, message
        FROM ai_generation_events
        WHERE task_id = $1
        ORDER BY timestamp ASC
      `, [task.id]);

      console.log('\n事件记录:');
      events.rows.forEach(e => {
        console.log(`  [${e.timestamp}] ${e.event_type}: ${e.message}`);
      });
      console.log('\n' + '='.repeat(60) + '\n');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkTasks();
