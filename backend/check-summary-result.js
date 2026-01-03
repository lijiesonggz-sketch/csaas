const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function check() {
  await client.connect();
  const result = await client.query(`
    SELECT id, type, status, result
    FROM ai_tasks
    WHERE type = 'summary' AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (result.rows.length > 0) {
    console.log('Summary Task Found:');
    console.log('ID:', result.rows[0].id);
    console.log('Result keys:', Object.keys(result.rows[0].result || {}));
    console.log('Result:', JSON.stringify(result.rows[0].result, null, 2).substring(0, 2000));
  } else {
    console.log('No completed summary task found');
  }
  await client.end();
}

check().catch(console.error);
