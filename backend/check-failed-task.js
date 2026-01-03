const { Client } = require('pg');

async function checkTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const taskId = '663bd1b7-873f-43ca-bff7-901fb26ebc30';

    // 查询任务详情
    const task = await client.query(`
      SELECT id, type, status, input, result, error_message, progress, created_at, updated_at
      FROM ai_tasks
      WHERE id = $1
    `, [taskId]);

    console.log('=== 任务详情 ===');
    console.log('ID:', task.rows[0].id);
    console.log('Type:', task.rows[0].type);
    console.log('Status:', task.rows[0].status);
    console.log('Progress:', task.rows[0].progress);
    console.log('Error:', task.rows[0].error_message || 'None');
    console.log('Created:', task.rows[0].created_at);
    console.log('Updated:', task.rows[0].updated_at);

    console.log('\n=== 输入数据 ===');
    console.log(JSON.stringify(task.rows[0].input, null, 2));

    console.log('\n=== 事件记录 ===');
    const events = await client.query(`
      SELECT id, model, error_message, execution_time_ms, created_at
      FROM ai_generation_events
      WHERE task_id = $1
      ORDER BY created_at ASC
    `, [taskId]);

    events.rows.forEach(e => {
      console.log('\nModel:', e.model);
      console.log('Error:', e.error_message || 'None');
      console.log('Time:', e.execution_time_ms + 'ms');
      console.log('Created:', e.created_at);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkTask();
