const { Client } = require('pg');

async function checkTaskResult() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas',
  });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT id, status, result, completed_at
      FROM ai_tasks
      WHERE id = '2326ba06-07e4-40dd-ae41-778c1efe0414'
    `);

    console.log('Task info:');
    console.log('ID:', result.rows[0].id);
    console.log('Status:', result.rows[0].status);
    console.log('Result type:', typeof result.rows[0].result);
    console.log('Result:', JSON.stringify(result.rows[0].result, null, 2));

    if (result.rows[0].result) {
      const resultData = typeof result.rows[0].result === 'string'
        ? JSON.parse(result.rows[0].result)
        : result.rows[0].result;
      console.log('\nParsed result keys:', Object.keys(resultData));
      console.log('Has content?', !!resultData.content);
      if (resultData.content) {
        console.log('Content type:', typeof resultData.content);
        console.log('Content length:', resultData.content?.length || 0);
      }
    }
  } finally {
    await client.end();
  }
}

checkTaskResult().catch(console.error);
