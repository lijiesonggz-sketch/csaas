const { Client } = require('pg');

async function checkNewTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const result = await client.query(`
    SELECT id, status, error_message, generation_stage, progress_details
    FROM ai_tasks
    WHERE id = '2cac27fc-75ea-4a17-a81a-bcace7c5fa62'
  `);

  if (result.rows.length > 0) {
    const task = result.rows[0];
    console.log('Task ID:', task.id.substring(0, 8) + '...');
    console.log('Status:', task.status);
    console.log('Stage:', task.generation_stage);
    console.log('Error:', task.error_message || 'None');
  }

  await client.end();
}

checkNewTask().catch(console.error);
