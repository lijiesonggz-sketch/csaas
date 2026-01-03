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

    const tasks = await client.query(`
      SELECT id, status, progress, error_message, created_at
      FROM ai_tasks
      WHERE type = 'action_plan'
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log('最近的 action_plan 任务:\n');
    tasks.rows.forEach(t => {
      console.log('ID:', t.id);
      console.log('Status:', t.status);
      console.log('Progress:', t.progress);
      console.log('Error:', t.error_message || 'None');
      console.log('Created:', t.created_at);
      console.log('---');
    });
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkTasks();
