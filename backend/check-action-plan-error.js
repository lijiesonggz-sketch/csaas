const { Client } = require('pg');

async function checkLatestError() {
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
    const task = await client.query(`
      SELECT id, status, error_message, progress, created_at, updated_at
      FROM ai_tasks
      WHERE type = 'action_plan'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (task.rows.length === 0) {
      console.log('没有找到 action_plan 任务');
      return;
    }

    const latestTask = task.rows[0];
    console.log('=== 最新任务 ===');
    console.log('ID:', latestTask.id);
    console.log('Status:', latestTask.status);
    console.log('Progress:', latestTask.progress);
    console.log('Error:', latestTask.error_message || 'None');
    console.log('Updated:', latestTask.updated_at);

    // 查询 AI 生成事件
    const events = await client.query(`
      SELECT id, model, error_message, execution_time_ms, created_at
      FROM ai_generation_events
      WHERE task_id = $1
      ORDER BY created_at ASC
    `, [latestTask.id]);

    console.log('\n=== AI 事件记录 ===');
    if (events.rows.length === 0) {
      console.log('(没有事件记录)');
    } else {
      events.rows.forEach((e, idx) => {
        console.log(`\n[事件 ${idx + 1}]`);
        console.log('  Model:', e.model);
        console.log('  Error:', e.error_message || 'None');
        console.log('  Time:', e.execution_time_ms + 'ms');
        console.log('  Created:', e.created_at);
      });
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkLatestError();
